import {createHash} from 'node:crypto';
import {normalizeTicker} from './engine.js';
import {responseJson} from './http.js';
import {exchangeDocumentUrl} from './source-import.js';
import {normalizeFiling} from './filings.js';
import {getCached,setCached,putRecord,singleFlight,consumeQuota} from './repository.js';

const day=86400000;
const dateParameter=time=>{const iso=new Date(time+330*60000).toISOString().slice(0,10);return `${iso.slice(8)}-${iso.slice(5,7)}-${iso.slice(0,4)}`;};
export function sourceCandidate({ticker,type,title,url,period,publishedAt=null,size=null}){
  try{url=exchangeDocumentUrl(url).href;}catch{return null;}
  if(!['annual_report','transcript'].includes(type))return null;
  const id='source-'+createHash('sha256').update(`${ticker}|${type}|${url}`).digest('hex').slice(0,32);
  return {id,ticker,type,title:String(title).slice(0,220),url,period:String(period).slice(0,40),publishedAt,size:size?String(size).slice(0,30):null,source:'NSE',discoveredAt:new Date().toISOString()};
}
export function annualCandidates(body,ticker){
  const rows=Array.isArray(body)?body:body?.data;if(!Array.isArray(rows))throw new Error('NSE returned an unexpected annual-report list.');
  if(rows.length>200)throw new Error('NSE annual-report list exceeded the supported limit.');
  return rows.filter(r=>/^\d{4}$/.test(r.fromYr)&&/^\d{4}$/.test(r.toYr)).sort((a,b)=>Number(b.toYr)-Number(a.toYr)).slice(0,4).map(r=>sourceCandidate({ticker,type:'annual_report',title:`${r.companyName||ticker} annual report ${r.fromYr}-${r.toYr}`,url:r.fileName,period:`FY${r.fromYr}-${String(r.toYr).slice(-2)}`,size:r.attFileSize})).filter(Boolean);
}
export function transcriptCandidates(rows,ticker){
  if(!Array.isArray(rows)||rows.length>500)throw new Error('NSE returned an unsupported historical filing list.');
  return rows.filter(r=>/\btranscripts?\b/i.test(`${r.desc} ${r.attchmntText}`)).map(normalizeFiling).filter(r=>r&&r.ticker===ticker).map(r=>sourceCandidate({ticker,type:'transcript',title:`${r.name} earnings-call transcript`,url:r.url,period:`Filed ${r.publishedAt.slice(0,10)}`,publishedAt:r.publishedAt})).filter(Boolean);
}
async function nseJson(url,fetchImpl,signal){
  const response=await fetchImpl(url,{headers:{'User-Agent':'Mozilla/5.0',Accept:'application/json',Referer:'https://www.nseindia.com/'},redirect:'error',signal,cache:'no-store'});
  if(!response.ok)throw new Error('NSE is unavailable or rate limited.');return responseJson(response,5000000);
}
export async function discoverSources(ticker,{fetchImpl=fetch,now=Date.now()}={}){
  ticker=normalizeTicker(ticker);const key=`sources-${Buffer.from(ticker).toString('hex')}`,cached=await getCached(key);
  if(cached&&now-new Date(cached.storedAt).getTime()<86400000)return {...cached.value,cached:true,stale:false};
  return singleFlight(key,async()=>{
    const minute=Math.floor(now/60000);if(!await consumeQuota(`discovery-${minute}`,20,(minute+1)*60000))throw Object.assign(new Error('Source discovery is busy. Retry in a minute.'),{status:429});
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000),found=[],warnings=[];let successful=0;
    const jobs=[{kind:'annual reports',url:`https://www.nseindia.com/api/annual-reports?index=equities&symbol=${encodeURIComponent(ticker)}`}];
    // Four bounded windows cover the previous year without affecting the digest watchlist.
    for(let i=0;i<4;i++)jobs.push({kind:'transcripts',url:'https://www.nseindia.com/api/corporate-announcements?'+new URLSearchParams({index:'equities',symbol:ticker,from_date:dateParameter(now-(i+1)*92*day),to_date:dateParameter(now-i*92*day)})});
    let cursor=0;
    try{await Promise.all(Array.from({length:2},async()=>{while(cursor<jobs.length){const job=jobs[cursor++];try{const body=await nseJson(job.url,fetchImpl,controller.signal);found.push(...(job.kind==='annual reports'?annualCandidates(body,ticker):transcriptCandidates(body,ticker)));successful++;}catch{warnings.push(`A ${job.kind} search could not complete. Upload a primary PDF if the document you need is missing.`);}}}));}
    finally{clearTimeout(timer);}
    if(!successful){const old=await getCached(key,{stale:true,maxAge:7*day});if(old)return {...old.value,cached:true,stale:true,warnings:['NSE could not be reached. Showing an earlier source list.']};throw Object.assign(new Error('NSE source discovery is unavailable. Upload a company-issued PDF or retry later.'),{status:502});}
    const candidates=[...new Map(found.map(c=>[c.id,c])).values()].sort((a,b)=>a.type.localeCompare(b.type)||(b.publishedAt||b.period).localeCompare(a.publishedAt||a.period)).slice(0,30);
    for(const candidate of candidates)await putRecord('researchSources',candidate.id,candidate);
    const value={ticker,candidates,warnings:[...new Set(warnings)],partial:warnings.length>0,searchedAt:new Date().toISOString(),transcriptLookbackDays:368};
    await setCached(key,value,warnings.length?600000:7*day);return {...value,cached:false,stale:false};
  });
}
