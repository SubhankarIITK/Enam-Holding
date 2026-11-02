import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {annualCandidates,transcriptCandidates,discoverSources} from '../lib/source-discovery.js';
import {getRecord,setCached} from '../lib/repository.js';
import {importPrimary} from '../lib/import-primary.js';
import {retrieve} from '../lib/retrieval.js';
const root=await mkdtemp(path.join(tmpdir(),'finn-sources-test-'));process.env.FINN_DATA_DIR=root;process.env.MONGODB_URI='';delete process.env.VERCEL;
after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.ok(path.basename(root).startsWith('finn-sources-test-'));await rm(root,{recursive:true,force:true});});
const annual={companyName:'Synthetic test company',fromYr:'2025',toYr:'2026',fileName:'https://nsearchives.nseindia.com/annual_reports/test.pdf',attFileSize:'18 MB'};
const transcript={symbol:'TEST',seq_id:'transcript',an_dt:'05-Aug-2026 15:11:52',desc:'Earnings call',attchmntText:'Transcript of investor call',attchmntFile:'https://nsearchives.nseindia.com/corporate/call.pdf'};
test('source discovery accepts primary NSE PDFs and excludes unsafe URLs and recordings',()=>{
  const list=annualCandidates({data:[annual,{...annual,fileName:'https://evil.example/report.pdf'}]},'TEST');assert.equal(list.length,1);assert.equal(list[0].period,'FY2025-26');
  assert.equal(transcriptCandidates([transcript,{...transcript,attchmntText:'Audio recording of investor call'}],'TEST').length,1);
  assert.equal(transcriptCandidates([{...transcript,symbol:'OTHER'}],'TEST').length,0);
});
test('historical discovery deduplicates, stores import candidates and reuses cached results',async()=>{
  let calls=0;const fetchImpl=async url=>{calls++;return Response.json(String(url).includes('annual-reports')?{data:[annual]}:[transcript,transcript]);};
  const result=await discoverSources('TEST',{fetchImpl});assert.equal(calls,5);assert.equal(result.candidates.length,2);assert.equal(result.partial,false);
  assert.equal((await getRecord('researchSources',result.candidates[0].id)).ticker,'TEST');
  assert.equal((await discoverSources('TEST',{fetchImpl})).cached,true);assert.equal(calls,5);
});
test('discovery exposes partial failures and retains earlier lists during an outage',async()=>{
  const result=await discoverSources('PARTIAL',{fetchImpl:async url=>String(url).includes('annual-reports')?Response.json({data:[annual]}):new Response('',{status:403})});assert.equal(result.partial,true);assert.equal(result.candidates.length,1);assert.ok(result.warnings.length);
  const key=`sources-${Buffer.from('OLD').toString('hex')}`;await setCached(key,{ticker:'OLD',candidates:[{id:'old-source'}]},-1);
  const stale=await discoverSources('OLD',{fetchImpl:async()=>new Response('',{status:403})});assert.equal(stale.stale,true);assert.equal(stale.candidates[0].id,'old-source');
});
test('large source import indexes text and retains a source link instead of an oversized original',async()=>{
  const source={id:'source-test',ticker:'TEST',title:'Synthetic test report',type:'annual_report',period:'FY26',url:annual.fileName};let saved;
  const result=await importPrimary(source,{download:async()=>Buffer.alloc(4000001),parse:async()=>({chunks:[{page:7,text:'Synthetic revenue evidence. '.repeat(8)}],quality:{pages:7}}),save:async(doc,original)=>{saved={doc,original};return {...doc,pages:1,chunkCount:1,hasOriginal:!!original};}});
  assert.equal(saved.original,null);assert.equal(result.originalPolicy,'source-link');assert.equal(result.hasOriginal,false);assert.equal(saved.doc.sourceSha256.length,64);assert.equal(saved.doc.chunks[0].page,7);
});
test('RAG retrieves relevant business and risk evidence and refuses unrelated zero-score passages',()=>{
  const docs=[{id:'report',title:'Test',chunks:[{page:1,text:'Our products include manufactured steel tubes for customers.'},{page:2,text:'Principal risks include lower demand and strong competition.'}]}];
  assert.equal(retrieve(docs,'What does this business do?')[0].page,1);
  assert.equal(retrieve(docs,'Give me the bull and bear case.')[0].page,2);
  assert.deepEqual(retrieve(docs,'Explain photosynthesis chlorophyll'),[]);
});
