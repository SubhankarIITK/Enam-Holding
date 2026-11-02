import {createHash} from 'node:crypto';
import {getRecord,putRecord,singleFlight,withLease} from './repository.js';
import {portfolioTickers,refreshPortfolio,savedPortfolio} from './portfolio-market.js';
import {refreshQuotes,savedQuotes} from './quotes.js';
import {syncFilings,readFilings} from './filings.js';
export const updateIntervals={quotes:60000,filings:120000,daily:900000};
export function updateDue(state,scope,now=Date.now()){
  return Object.fromEntries(Object.entries(updateIntervals).map(([kind,interval])=>[kind,state?.scope!==scope||!state?.[kind]?.attemptedAt||now-new Date(state[kind].attemptedAt).getTime()>=interval]));
}
export async function updateSnapshot(tickers){
  const [feed,market,quotes,state]=await Promise.all([readFilings(tickers,168),tickers.length?savedPortfolio(tickers):{prices:{}},savedQuotes(tickers),getRecord('workspace','automatic')]);return {feed,prices:market.prices,quotes,state,checkedAt:new Date().toISOString()};
}
export async function refreshWorkspace(input,{filingsJob=syncFilings,quotesJob=refreshQuotes,dailyJob=refreshPortfolio,now=Date.now}={}){
  const tickers=Array.isArray(input)&&!input.length?[]:portfolioTickers(input),scope=createHash('sha256').update([...tickers].sort().join(',')).digest('hex');
  return singleFlight(`automatic-${scope}`,()=>withLease('automatic-updates',async()=>{
    await putRecord('workspace','watchlist',{tickers});
    const previous=await getRecord('workspace','automatic'),due=updateDue(previous,scope,now()),state={...(previous?.scope===scope?previous:{}),scope,tickers},started=new Date(now()).toISOString();
    const jobs={filings:filingsJob,quotes:quotesJob,daily:dailyJob};
    for(const kind of Object.keys(jobs))if(due[kind])state[kind]={...state[kind],attemptedAt:started,status:'updating'};
    await putRecord('workspace','automatic',state);
    await Promise.all(Object.entries(jobs).map(async([kind,job])=>{if(!due[kind]||!tickers.length)return;try{const result=await job(tickers);const successes=result.results?.filter(r=>r.ok&&!r.stale).length||0;state[kind]={...state[kind],status:result.partial?'partial':'ok',completedAt:new Date(now()).toISOString(),...(successes?{succeededAt:new Date(now()).toISOString()}:{}),ready:successes,total:tickers.length};}catch{state[kind]={...state[kind],status:'error',completedAt:new Date(now()).toISOString()};}}));
    if(!tickers.length)for(const kind of Object.keys(jobs))state[kind]={status:'empty',attemptedAt:started};
    await putRecord('workspace','automatic',state);return state;
  }));
}
