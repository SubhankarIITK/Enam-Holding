import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {storageConfig,getRecord,putRecord,queryRecords,saveOriginal,getOriginal,getCached,setCached,singleFlight} from '../lib/repository.js';
import {authorize,secretMatches,getDocuments} from '../lib/backend.js';
import {exchangeDate,classifyFiling,normalizeFiling,fetchNseFilings,syncFilings,readFilings} from '../lib/filings.js';
import {exchangeDocumentUrl,downloadExchangePdf} from '../lib/source-import.js';
import {summarizeMarket,getMarket} from '../lib/market.js';
import {researchCacheKey,cachedResearch} from '../lib/research-cache.js';
import {retrieve} from '../lib/retrieval.js';

const root=await mkdtemp(path.join(tmpdir(),'finn-v1-test-'));
process.env.FINN_DATA_DIR=root;process.env.MONGODB_URI='';delete process.env.VERCEL;process.env.FINN_ACCESS_KEY='test-only-key';
after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.ok(path.basename(root).startsWith('finn-v1-test-'));await rm(root,{recursive:true,force:true});});
const row={symbol:'INFY',seq_id:'42',an_dt:'27-Oct-2026 16:38:30',sm_name:'Infosys Limited',desc:'Financial Results',attchmntText:'Quarterly financial results have been filed.',attchmntFile:'https://nsearchives.nseindia.com/corporate/test.pdf'};
const time=Date.parse('2026-10-27T14:00:00Z');

test('local development storage is durable across independent processes',async()=>{
  await putRecord('documents','persisted',{ticker:'INFY',title:'Synthetic test',createdAt:'2026-10-27'});
  assert.equal((await getRecord('documents','persisted')).title,'Synthetic test');
  const output=execFileSync(process.execPath,['--input-type=module','-e',"import {getRecord} from './lib/repository.js'; console.log((await getRecord('documents','persisted')).ticker)"],{cwd:process.cwd(),env:process.env,encoding:'utf8'});
  assert.equal(output.trim(),'INFY');
  assert.equal((await queryRecords('documents',{query:{ticker:{$in:['INFY']}}})).length,1);
  await assert.rejects(()=>getRecord('documents','../escape'),/Invalid record/);
});
test('original PDF bytes round-trip exactly and absent files return null',async()=>{
  const pdf=Buffer.from('%PDF-1.4\nSYNTHETIC TEST ONLY');await saveOriginal('original-test',pdf);
  assert.deepEqual(await getOriginal('original-test'),pdf);assert.equal(await getOriginal('absent'),null);
});
test('v0 documents still held by the running server migrate into durable v1 storage',async()=>{
  globalThis.__finnState={documents:new Map([['legacy-doc',{id:'legacy-doc',ticker:'LEGACY',title:'Existing v0 document',chunks:[{page:1,text:'Existing source text.'}],createdAt:'2026-10-26'}]])};
  const docs=await getDocuments('LEGACY');assert.equal(docs.length,1);assert.equal(docs[0].migratedFrom,'v0-memory');assert.equal(docs[0].hasOriginal,false);assert.equal(globalThis.__finnState.documents.size,0);
});
test('invalid Mongo configuration is explicit and deployment never falls back to disk',async()=>{
  process.env.MONGODB_URI='not-a-mongodb-uri';assert.equal(storageConfig().mode,'local-disk');assert.match(storageConfig().warning,/invalid/);
  process.env.VERCEL='1';assert.equal(storageConfig().mode,'unconfigured');await assert.rejects(()=>getRecord('workspace','test'),/storage is unavailable/);
  delete process.env.VERCEL;process.env.MONGODB_URI='';
});
test('workspace key and origin protection do not accept invalid credentials',async()=>{
  assert.equal(secretMatches('wrong','right'),false);assert.equal(secretMatches('same','same'),true);
  assert.equal((await authorize(new Request('http://localhost/api/health'))).status,401);
  assert.equal(await authorize(new Request('http://localhost/api/health',{headers:{'x-finn-key':'test-only-key'}})),null);
  const foreign=new Request('http://localhost/api/documents',{method:'POST',headers:{'x-finn-key':'test-only-key',origin:'https://other.example'}});
  assert.equal((await authorize(foreign)).status,403);
  const proxied=new Request('http://localhost:3000/api/documents',{method:'POST',headers:{'x-finn-key':'test-only-key',host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'}});
  assert.equal(await authorize(proxied),null);
});
test('cache expiration and stale fallback distinguish saved time from validity',async()=>{
  await setCached('cache-test',{answer:'synthetic'},10000);assert.ok(await getCached('cache-test'));
  await putRecord('cache','expired',{value:{a:1},storedAt:new Date(Date.now()-1800000).toISOString(),expiresAt:new Date(Date.now()-1000)});
  assert.equal(await getCached('expired'),null);assert.ok(await getCached('expired',{stale:true}));
  assert.equal(await getCached('expired',{stale:true,maxAge:1000}),null);
});
test('simultaneous equivalent work is coalesced but rejected work can retry',async()=>{
  let resolve,calls=0;const pending=new Promise(done=>resolve=done);
  const first=singleFlight('same',()=>{calls++;return pending;}),second=singleFlight('same',()=>{calls++;return 2;});
  await Promise.resolve();resolve(7);assert.deepEqual(await Promise.all([first,second]),[7,7]);assert.equal(calls,1);
  await assert.rejects(()=>singleFlight('retry',()=>{throw new Error('failed');}));assert.equal(await singleFlight('retry',()=>9),9);
});
test('NSE timestamps use Indian time and filing IDs deduplicate independent of order',()=>{
  assert.equal(exchangeDate(row.an_dt),'2026-10-27T11:08:30.000Z');assert.equal(exchangeDate('nonsense'),null);
  assert.equal(normalizeFiling(row).id,normalizeFiling({...row,attchmntText:'Updated description'}).id);
  assert.equal(normalizeFiling({...row,an_dt:'invalid'}),null);
  assert.equal(normalizeFiling({...row,attchmntFile:'https://localhost/secret.pdf'}).url,null);
  assert.equal(normalizeFiling(row).demo,false);
});
test('priority rules keep routine results advertisements below actual results',()=>{
  assert.deepEqual(classifyFiling('Copy of Newspaper Publication of quarterly financial results'),{category:'unclassified',priority:'low'});
  assert.deepEqual(classifyFiling('Unaudited Financial Results'),{category:'results',priority:'high'});
  assert.equal(classifyFiling('Appointment of new CFO').category,'management_change');
  assert.equal(classifyFiling('Earnings call transcript').category,'earnings_call');
});
test('live ingestion validates provider shape and a partial sync preserves successful companies',async()=>{
  const fetchImpl=async url=>new URL(url).searchParams.get('symbol')==='TCS'?new Response('',{status:403}):Response.json([row,row]);
  assert.equal((await fetchNseFilings('INFY',{fetchImpl,now:time})).length,2);
  const first=await syncFilings(['INFY','TCS'],{fetchImpl});assert.equal(first.partial,true);assert.equal(first.inserted,1);
  const next=await syncFilings(['INFY'],{fetchImpl});assert.equal(next.inserted,0);
  const feed=await readFilings(['INFY'],24,time);assert.equal(feed.announcements.length,1);assert.equal(feed.announcements[0].category,'results');
  await putRecord('workspace','watchlist',{tickers:['INFY','TCS']});await syncFilings(['INFY'],{fetchImpl});assert.deepEqual((await getRecord('workspace','watchlist')).tickers,['INFY','TCS']);
  await assert.rejects(()=>fetchNseFilings('INFY',{fetchImpl:async()=>Response.json({unexpected:true})}),/format/);
});
test('exchange document importer rejects arbitrary hosts and unsafe redirects',async()=>{
  for(const url of ['http://nsearchives.nseindia.com/a.pdf','https://localhost/a.pdf','https://nsearchives.nseindia.com.evil.example/a.pdf','https://user:pass@nsearchives.nseindia.com/a.pdf','https://nsearchives.nseindia.com/a.html'])assert.throws(()=>exchangeDocumentUrl(url));
  await assert.rejects(()=>downloadExchangePdf(row.attchmntFile,{fetchImpl:async()=>new Response('',{status:302,headers:{location:'http://127.0.0.1/private'}})}),/archive hosts/);
  const bytes=Buffer.from('%PDF-synthetic');assert.deepEqual(await downloadExchangePdf(row.attchmntFile,{fetchImpl:async()=>new Response(bytes)}),bytes);
  await assert.rejects(()=>downloadExchangePdf(row.attchmntFile,{fetchImpl:async()=>new Response('',{headers:{'content-length':'5000000'}})}),/exceeds 4 MB/);
});
function chart(){const timestamp=Array.from({length:21},(_,i)=>Date.parse('2026-10-26T03:45:00Z')/1000-(20-i)*86400);return {timestamp,meta:{currency:'INR'},indicators:{quote:[{close:timestamp.map((_,i)=>100+i),volume:timestamp.map((_,i)=>i===20?300:100)}]}};}
test('market volume baseline excludes the evaluated day and cache avoids repeated upstream requests',async()=>{
  const summary=summarizeMarket(chart(),'INFY',time);assert.equal(summary.volume,3);assert.equal(summary.price,120);
  let calls=0;const fetchImpl=async()=>{calls++;return Response.json({chart:{result:[chart()]}});};
  assert.equal((await getMarket('CACHECO',{fetchImpl})).cached,false);assert.equal((await getMarket('CACHECO',{fetchImpl})).cached,true);assert.equal(calls,1);
  const key='market-'+Buffer.from('STALECO').toString('hex');await putRecord('cache',key,{value:summary,storedAt:new Date(Date.now()-1800000).toISOString(),expiresAt:new Date(Date.now()+10000)});
  const old=await getMarket('STALECO',{fetchImpl:async()=>{throw new Error('fetch failed');}});assert.equal(old.stale,true);assert.equal(old.price,120);
});
test('research cache invalidates when question, source text or model changes',async()=>{
  const source={id:'test-source',citation:1,title:'Synthetic report',page:1,text:'Revenue was 100 crore.'};
  const options={ticker:'INFY',question:'What is revenue?',model:'test-model',sources:[source],apiKey:'test-only'};
  const key=researchCacheKey(options);assert.equal(key,researchCacheKey({...options,question:' WHAT IS REVENUE? '}));
  assert.notEqual(key,researchCacheKey({...options,sources:[{...source,text:'Revenue was 200 crore.'}]}));
  assert.notEqual(key,researchCacheKey({...options,model:'other'}));
  let calls=0;const fetchImpl=async()=>{calls++;return Response.json({choices:[{message:{content:JSON.stringify({answer:'Revenue was 100 crore [1].',citations:[1]})}}]});};
  assert.equal((await cachedResearch({...options,fetchImpl})).cached,false);assert.equal((await cachedResearch({...options,fetchImpl})).cached,true);assert.equal(calls,1);
});
test('retrieval suppresses duplicated passages and retains page-level provenance',()=>{
  const docs=[{id:'report',title:'Annual report',chunks:[{page:1,text:'Operating cash flow was 100 crore.'},{page:1,text:'Operating cash flow was 100 crore.'}]},{id:'call',title:'Call',chunks:[{page:4,text:'Management expects cash conversion to improve.'}]}];
  const results=retrieve(docs,'cash conversion');assert.equal(results.length,2);assert.ok(results.every(r=>r.documentId&&r.page&&r.citation));assert.ok(results.every(r=>Number.isFinite(r.score)));
});
