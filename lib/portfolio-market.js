import {normalizeTicker} from './engine.js';
import {getCached} from './repository.js';
import {getMarket} from './market.js';

export function portfolioTickers(input) {
  if(!Array.isArray(input)||!input.length||input.length>40)throw new Error('Select between 1 and 40 companies.');
  return [...new Set(input.map(normalizeTicker))];
}
export async function savedPortfolio(input) {
  const tickers=portfolioTickers(input),prices={};
  await Promise.all(tickers.map(async ticker=>{
    const row=await getCached(`market-${Buffer.from(ticker).toString('hex')}`,{stale:true,maxAge:86400000});
    if(row)prices[ticker]={...row.value,cached:true,stale:Date.now()-new Date(row.storedAt).getTime()>=900000,staleReason:'age',cachedAt:row.storedAt};
  }));
  return {prices,missing:tickers.filter(t=>!prices[t]),source:'Yahoo Finance',checkedAt:new Date().toISOString()};
}
export async function refreshPortfolio(input,{fetchPrice=getMarket,now=Date.now}={}) {
  const tickers=portfolioTickers(input),prices={},results=[],started=now();let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,tickers.length)},async()=>{
    while(cursor<tickers.length){
      const ticker=tickers[cursor++];
      if(now()-started>38000){results.push({ticker,ok:false,error:'Refresh time limit reached. Retry to finish remaining companies.'});continue;}
      try{const price=await fetchPrice(ticker);prices[ticker]=price;results.push({ticker,ok:true,stale:!!price.stale,cached:!!price.cached});}
      catch{results.push({ticker,ok:false,error:'Price provider unavailable for this company. Retry later.'});}
    }
  }));
  return {prices,results,partial:results.some(r=>!r.ok||r.stale),finishedAt:new Date().toISOString()};
}
