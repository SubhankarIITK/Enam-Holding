import {normalizeTicker} from './engine.js';
import {responseJson} from './http.js';
import {getCached,setCached,singleFlight} from './repository.js';
import {portfolioTickers} from './portfolio-market.js';
export function summarizeQuote(chart,ticker,now=Date.now()){
  const meta=chart?.meta,price=meta?.regularMarketPrice,time=meta?.regularMarketTime,previous=meta?.previousClose??meta?.chartPreviousClose;
  if(!Number.isFinite(price)||price<=0||!Number.isFinite(time)||time*1000>now+60000||time<1262304000||!Number.isFinite(previous)||previous<=0)throw new Error('No dated market quote is available.');
  return {ticker,price,change:(price-previous)/previous*100,previousClose:previous,asOf:new Date(time*1000).toISOString(),source:'Yahoo Finance',currency:meta.currency||'INR',kind:'quote-snapshot',demo:false,delay:'Provider latency is not guaranteed.'};
}
export async function getQuote(ticker,{fetchImpl=fetch}={}){
  ticker=normalizeTicker(ticker);const key=`quote-${Buffer.from(ticker).toString('hex')}`,cached=await getCached(key);
  if(cached&&Date.now()-new Date(cached.storedAt).getTime()<60000)return {...cached.value,cached:true,stale:false};
  return singleFlight(key,async()=>{
    try{const response=await fetchImpl(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker+'.NS')}?range=1d&interval=1m`,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000),redirect:'error',cache:'no-store'});if(!response.ok)throw new Error('Quote provider unavailable.');const json=await responseJson(response),value=summarizeQuote(json.chart?.result?.[0],ticker);await setCached(key,value,86400000);return {...value,cached:false,stale:false};}
    catch{const old=await getCached(key,{stale:true,maxAge:86400000});if(old)return {...old.value,cached:true,stale:true,warning:'Quote provider unavailable. Showing a saved quote.'};throw Object.assign(new Error('A recent quote could not be loaded. The completed daily price remains available.'),{status:502});}
  });
}
export async function savedQuotes(tickers){const quotes={};await Promise.all(tickers.map(async ticker=>{const row=await getCached(`quote-${Buffer.from(ticker).toString('hex')}`,{stale:true,maxAge:86400000});if(row)quotes[ticker]={...row.value,cached:true,stale:Date.now()-new Date(row.storedAt).getTime()>=60000};}));return quotes;}
export async function refreshQuotes(input,{fetchQuote=getQuote,now=Date.now}={}){
  const tickers=portfolioTickers(input),results=[],quotes={},started=now();let index=0;
  await Promise.all(Array.from({length:Math.min(4,tickers.length)},async()=>{while(index<tickers.length){const ticker=tickers[index++];if(now()-started>38000){results.push({ticker,ok:false});continue;}try{const quote=await fetchQuote(ticker);quotes[ticker]=quote;results.push({ticker,ok:true,stale:quote.stale});}catch{results.push({ticker,ok:false});}}}));return {quotes,results,partial:results.some(r=>!r.ok||r.stale)};
}
