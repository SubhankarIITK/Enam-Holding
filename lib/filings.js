import {responseJson} from './http.js';
import {createHash,randomUUID} from 'node:crypto';
import {normalizeTicker} from './engine.js';
import {getRecord,putRecord,queryRecords,singleFlight,withLease} from './repository.js';

const month={Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
export function exchangeDate(value) {
  const text=String(value||'').trim(),match=text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d\d:\d\d:\d\d)$/);
  let iso=match&&month[match[2]]?`${match[3]}-${month[match[2]]}-${match[1].padStart(2,'0')}T${match[4]}+05:30`:text;
  if(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(iso))iso=iso.replace(' ','T')+'+05:30';
  if(!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(iso))return null;
  const date=new Date(iso);return Number.isNaN(date.getTime())?null:date.toISOString();
}
export function classifyFiling(text) {
  const t=text.toLowerCase();
  if(/newspaper|esop|esos|trading window|compliance certificate|loss of share|duplicate share|regulation 74|share transfer agent|investor grievance|dematerial/.test(t))return {category:'unclassified',priority:'low'};
  if(/conference call|earnings call|concall|audio recording|transcript/.test(t))return {category:'earnings_call',priority:'medium'};
  if(/chief executive|chief financial|\bcfo\b|\bceo\b|managing director|resignation.*director|appointment.*director/.test(t))return {category:'management_change',priority:'high'};
  if(/financial results|quarterly results|audited financial|unaudited financial/.test(t))return {category:'results',priority:/board meeting intimation/.test(t)?'medium':'high'};
  if(/acquisition|\bmerger\b|demerger|joint venture/.test(t))return {category:'M&A',priority:'high'};
  if(/litigation|penalty|regulatory order|insolvency|fraud|default/.test(t))return {category:'litigation',priority:'high'};
  if(/fund rais|rights issue|preferential allotment|qualified institutional|buyback|commercial paper/.test(t))return {category:'fund_raise',priority:'high'};
  if(/pledge|pledging/.test(t))return {category:'pledging',priority:'high'};
  if(/credit rating|rating reaffirm|rating downgrade|rating upgrade/.test(t))return {category:'credit_rating',priority:'medium'};
  if(/capital expenditure|capacity expansion|new plant|\bcapex\b/.test(t))return {category:'capex',priority:'high'};
  if(/dividend/.test(t))return {category:'dividend',priority:'low'};
  if(/bonus|stock split|sub.?division/.test(t))return {category:'bonus_split',priority:'medium'};
  if(/postal ballot/.test(t))return {category:'postal_ballot',priority:'low'};
  if(/annual general meeting|extraordinary general meeting|\bagm\b|\begm\b/.test(t))return {category:'agm_egm',priority:'low'};
  if(/investor meet|analyst meet|investor conference/.test(t))return {category:'investor_meetings',priority:'low'};
  if(/insider|promoter.*(?:buy|sell|disposal|acquisition)/.test(t))return {category:'insider_trading',priority:'medium'};
  if(/press release|order win|partnership|product launch|updates/.test(t))return {category:'press_release',priority:'medium'};
  return {category:'unclassified',priority:'low'};
}
export function normalizeFiling(row) {
  let ticker;try{ticker=normalizeTicker(row.symbol);}catch{return null;}
  const publishedAt=exchangeDate(row.an_dt||row.exchdisstime||row.sort_date);
  if(!publishedAt)return null;
  const name=String(row.sm_name||ticker).slice(0,180),subject=String(row.desc||'Company disclosure').trim().slice(0,300),text=String(row.attchmntText||subject).trim().slice(0,12000);
  let url=null;try{const link=new URL(row.attchmntFile);if(link.protocol==='https:'&&['nsearchives.nseindia.com','archives.nseindia.com','www.nseindia.com'].includes(link.hostname)&&!link.username&&!link.password)url=link.href;}catch{}
  const id='nse-'+createHash('sha256').update(`${ticker}:${row.seq_id||url+publishedAt}`).digest('hex').slice(0,32);
  return {id,ticker,name,title:`${name}: ${subject}`,summary:text.slice(0,700),sourceText:text,url,publishedAt,...classifyFiling(subject+' '+text),why:'This is an exchange-filed company disclosure. Review the original attachment before interpreting its financial impact.',source:'NSE',demo:false,ingestedAt:new Date().toISOString()};
}
function dateParameter(time) {const iso=new Date(time+330*60000).toISOString().slice(0,10);return iso.slice(8)+'-'+iso.slice(5,7)+'-'+iso.slice(0,4);}
export async function fetchNseFilings(ticker,{fetchImpl=fetch,now=Date.now(),timeout=7000}={}) {
  ticker=normalizeTicker(ticker);
  const url=new URL('https://www.nseindia.com/api/corporate-announcements');
  url.search=new URLSearchParams({index:'equities',symbol:ticker,from_date:dateParameter(now-7*86400000),to_date:dateParameter(now)}).toString();
  const response=await fetchImpl(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json','Referer':'https://www.nseindia.com/companies-listing/corporate-filings-announcements'},redirect:'error',signal:AbortSignal.timeout(timeout),cache:'no-store'});
  if(!response.ok)throw new Error(`NSE returned HTTP ${response.status}.`);
  const rows=await responseJson(response,5000000);
  if(!Array.isArray(rows))throw new Error('NSE returned an unexpected announcement format.');
  if(rows.length>500)throw new Error('This company returned more than 500 filings. A narrower ingestion window is required.');
  return rows.slice(0,500).map(normalizeFiling).filter(item=>item&&item.ticker===ticker);
}
export async function syncFilings(tickers,{fetchImpl=fetch,saveWatchlist=false}={}) {
  if(!Array.isArray(tickers)||tickers.length>40)throw new Error('Sync between 1 and 40 NSE tickers.');
  tickers=[...new Set(tickers.map(normalizeTicker))].sort();
  if(!tickers.length||tickers.length>40)throw new Error('Sync between 1 and 40 NSE tickers.');
  const key='sync-'+createHash('sha256').update(tickers.join(',')).digest('hex');
  return singleFlight(key,()=>withLease('filings-sync',async()=>{
    const started=Date.now(),id=randomUUID(),results=[];
    if(saveWatchlist)await putRecord('workspace','watchlist',{tickers});
    await putRecord('workspace','feed',{id,startedAt:new Date(started).toISOString(),running:true});
    let index=0;
    async function worker(){while(index<tickers.length){const ticker=tickers[index++];
      if(Date.now()-started>40000){results.push({ticker,ok:false,error:'Sync time budget reached. Retry this ticker.'});continue;}
      try{
        const items=await fetchNseFilings(ticker,{fetchImpl,timeout:Math.min(7000,Math.max(1000,43000-(Date.now()-started)))});
        let inserted=0;
        for(const item of items){if(Date.now()-started>50000)throw new Error('Sync time budget reached while saving. Retry to finish this company.');if(!await getRecord('filings',item.id))inserted++;await putRecord('filings',item.id,item);}
        results.push({ticker,ok:true,fetched:items.length,inserted});
      }catch(error){results.push({ticker,ok:false,error:error.name==='TimeoutError'?'NSE request timed out.':error.message});}
    }}
    await Promise.all(Array.from({length:Math.min(4,tickers.length)},worker));
    const report={id,startedAt:new Date(started).toISOString(),finishedAt:new Date().toISOString(),running:false,tickers,results,partial:results.some(r=>!r.ok),inserted:results.reduce((n,r)=>n+(r.inserted||0),0),fetched:results.reduce((n,r)=>n+(r.fetched||0),0)};
    await putRecord('sync',id,report);await putRecord('workspace','feed',report);return report;
  }));
}
export async function readFilings(tickers,hours=24,now=Date.now()) {
  const items=await queryRecords('filings',{query:{ticker:{$in:tickers},publishedAt:{$gte:new Date(now-hours*3600000).toISOString(),$lte:new Date(now).toISOString()}},sort:{publishedAt:-1},limit:1001});
  const sync=await getRecord('workspace','feed');if(sync?.running&&now-new Date(sync.startedAt).getTime()>90000){sync.running=false;sync.interrupted=true;}
  return {announcements:items.slice(0,1000).map(a=>({...a,hoursAgo:Math.max(0,(now-new Date(a.publishedAt).getTime())/3600000)})),sync,limit:1000,truncated:items.length>1000};
}
