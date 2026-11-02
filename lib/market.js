import {responseJson} from './http.js';
import {normalizeTicker} from './engine.js';
import {marketSeries} from './charts.js';
import {getCached,setCached,singleFlight} from './repository.js';

export function summarizeMarket(chart,ticker,now=Date.now()) {
  const quote=chart?.indicators?.quote?.[0];
  if(!quote||!Array.isArray(chart.timestamp))throw new Error('No price history found for this NSE ticker.');
  const ist=new Date(now+330*60000),day=ist.toISOString().slice(0,10),hour=ist.getUTCHours();
  const rows=chart.timestamp.map((time,i)=>({time,close:quote.close?.[i],volume:quote.volume?.[i]})).filter(r=>Number.isFinite(r.time)&&Number.isFinite(r.close)&&r.close>0&&Number.isFinite(r.volume)&&r.volume>=0&&r.time*1000<=now&&!(new Date(r.time*1000+330*60000).toISOString().slice(0,10)===day&&hour<16));
  if(rows.length<21)throw new Error('Not enough completed sessions for a 20-day volume baseline.');
  const latest=rows.at(-1),previous=rows.at(-2),baseline=rows.slice(-21,-1).reduce((n,r)=>n+r.volume,0)/20;
  return {ticker,name:chart.meta?.longName||chart.meta?.shortName||ticker,price:latest.close,change:(latest.close-previous.close)/previous.close*100,volume:baseline>0?latest.volume/baseline:0,asOf:new Date(latest.time*1000).toISOString(),currency:chart.meta?.currency||'INR',history:rows.slice(-30).map(r=>r.close),series:marketSeries(rows),demo:false,source:'Yahoo Finance · completed daily sessions'};
}
export async function getMarket(ticker,{fetchImpl=fetch}={}) {
  ticker=normalizeTicker(ticker);const key=`market-${Buffer.from(ticker).toString('hex')}`;
  const cached=await getCached(key);if(cached&&Date.now()-new Date(cached.storedAt).getTime()<900000)return {...cached.value,cached:true,stale:false,cachedAt:cached.storedAt};
  return singleFlight(key,async()=>{
    try {
      const response=await fetchImpl(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker+'.NS')}?range=3mo&interval=1d`,{headers:{'User-Agent':'Mozilla/5.0'},redirect:'error',signal:AbortSignal.timeout(12000),cache:'no-store'});
      if(!response.ok)throw new Error('Price provider is unavailable or rate limited.');
      const json=await responseJson(response),value=summarizeMarket(json.chart?.result?.[0],ticker);
      await setCached(key,value,86400000);return {...value,cached:false,stale:false};
    }catch(error){
      const old=await getCached(key,{stale:true,maxAge:86400000});
      if(old)return {...old.value,cached:true,stale:true,cachedAt:old.storedAt,warning:'Provider unavailable. Showing the previously saved daily session.'};
      throw Object.assign(new Error(error.name==='TimeoutError'?'Price request timed out. Please retry.':error.message==='fetch failed'?'Could not reach the price provider. Retry later.':error.message),{status:502});
    }
  });
}
