import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {refreshWorkspace,updateDue} from '../lib/automatic-updates.js';
import {summarizeQuote,refreshQuotes,getQuote} from '../lib/quotes.js';
import {getRecord,putRecord} from '../lib/repository.js';
const root=await mkdtemp(path.join(tmpdir(),'finn-automatic-test-'));process.env.FINN_DATA_DIR=root;process.env.MONGODB_URI='';delete process.env.VERCEL;
after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.ok(path.basename(root).startsWith('finn-automatic-test-'));await rm(root,{recursive:true,force:true});});
test('automatic jobs obey independent cooldowns, refresh changed portfolios and back off failures',async()=>{
  let time=1793600000000;const calls={quotes:0,filings:0,daily:0},jobs=Object.fromEntries(Object.keys(calls).map(kind=>[kind+'Job',async tickers=>{calls[kind]++;return {results:tickers.map(ticker=>({ticker,ok:true})),partial:false};}]));
  const options={...jobs,now:()=>time};await refreshWorkspace(['INFY'],options);await refreshWorkspace(['INFY'],options);assert.deepEqual(calls,{quotes:1,filings:1,daily:1});
  time+=60001;await refreshWorkspace(['INFY'],options);assert.deepEqual(calls,{quotes:2,filings:1,daily:1});
  time+=60000;await refreshWorkspace(['INFY'],options);assert.deepEqual(calls,{quotes:3,filings:2,daily:1});
  await refreshWorkspace(['TCS'],options);assert.deepEqual(calls,{quotes:4,filings:3,daily:2});
  time+=120001;let failures=0;const failing={...options,filingsJob:async()=>{failures++;throw new Error('provider offline');}};
  const state=await refreshWorkspace(['TCS'],failing);assert.equal(state.filings.status,'error');assert.ok(state.filings.succeededAt);await refreshWorkspace(['TCS'],failing);assert.equal(failures,1);
  await refreshWorkspace([],options);assert.deepEqual(calls,{quotes:5,filings:3,daily:2});
});
test('quotes retain provider timestamps, reject missing/future values, and isolate company failures',async()=>{
  const now=1793600000000,chart={meta:{regularMarketPrice:120,previousClose:100,regularMarketTime:now/1000-3600,currency:'INR'}};
  const quote=summarizeQuote(chart,'INFY',now);assert.equal(quote.change,20);assert.equal(quote.asOf,new Date(now-3600000).toISOString());assert.equal(quote.demo,false);
  assert.throws(()=>summarizeQuote({meta:{...chart.meta,regularMarketTime:now/1000+1000}},'INFY',now));assert.throws(()=>summarizeQuote({meta:{regularMarketPrice:120}},'INFY',now));
  const batch=await refreshQuotes(['INFY','TCS'],{fetchQuote:async ticker=>{if(ticker==='TCS')throw new Error('offline');return quote;}});assert.equal(batch.partial,true);assert.equal(batch.quotes.TCS,undefined);assert.equal(batch.quotes.INFY.price,120);
});
test('cached quotes avoid duplicate requests and preserve stale data on provider failure',async()=>{
  let requests=0;const fetchImpl=async()=>{requests++;return Response.json({chart:{result:[{meta:{regularMarketPrice:120,previousClose:100,regularMarketTime:Math.floor(Date.now()/1000)}}]}});};
  await getQuote('TEST',{fetchImpl});const second=await getQuote('TEST',{fetchImpl});assert.equal(requests,1);assert.equal(second.cached,true);
  const key=`quote-${Buffer.from('TEST').toString('hex')}`,cached=await getRecord('cache',key);await putRecord('cache',key,{...cached,storedAt:new Date(Date.now()-61000).toISOString()});
  const fallback=await getQuote('TEST',{fetchImpl:async()=>{throw new Error('provider offline');}});assert.equal(fallback.stale,true);assert.equal(fallback.price,120);assert.equal(fallback.asOf,second.asOf);
  assert.deepEqual(updateDue(null,'new'),{quotes:true,filings:true,daily:true});
});
