import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {extractDocument} from '../lib/insight-extraction.js';
import {queryRecords} from '../lib/repository.js';
const root=await mkdtemp(path.join(tmpdir(),'finn-extraction-test-'));process.env.FINN_DATA_DIR=root;process.env.MONGODB_URI='';delete process.env.VERCEL;
after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.ok(path.basename(root).startsWith('finn-extraction-test-'));await rm(root,{recursive:true,force:true});});
const document={id:'synthetic-extraction-document',ticker:'TEST',title:'Synthetic unit-test transcript',type:'transcript',chunks:[{page:1,text:'Consolidated Q2 FY26. INR crore. Revenue 120. Business provides manufacturing products.'}],publishedAt:'2025-10-20T00:00:00Z'};
test('reasoning models use a bounded low-effort extraction, validate records, reuse the cache and retain cleanup metadata',async()=>{
  let calls=0;const fetchImpl=async(url,options)=>{calls++;assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');const body=JSON.parse(options.body);assert.equal(body.reasoning_effort,'low');assert.equal(body.max_tokens,3500);return Response.json({choices:[{message:{content:JSON.stringify({figures:[{metric:'Revenue',value:120,unit:'INR crore',basis:'Consolidated',periodType:'Quarter',periodLabel:'Q2 FY26',periodEnd:'2025-09-30',citation:1,quote:'Revenue 120.',context:document.chunks[0].text}]})}}]});};
  const result=await extractDocument(document,{apiKey:'synthetic-test-key',model:'openai/gpt-oss-120b',fetchImpl});assert.equal(result.figures.length,1);assert.equal(result.figures[0].value,120);assert.equal((await extractDocument(document,{apiKey:'synthetic-test-key',fetchImpl})).cached,true);assert.equal(calls,1);assert.equal((await queryRecords('cache',{query:{documentId:document.id}})).length,1);
});
test('usage limits return a retry time without caching an invented empty analysis',async()=>{
  const d={...document,id:'synthetic-rate-document'};await assert.rejects(()=>extractDocument(d,{apiKey:'synthetic-test-key',fetchImpl:async()=>Response.json({error:{message:'Rate limit'}},{status:429,headers:{'Retry-After':'41'}})}),e=>e.status===429&&e.retryAfter===41);assert.equal((await queryRecords('cache',{query:{documentId:d.id}})).length,0);
});
test('a provider size rejection retries once with a smaller response budget',async()=>{
  let calls=0;const d={...document,id:'synthetic-size-document'},fetchImpl=async(url,options)=>{calls++;const body=JSON.parse(options.body);if(calls===1)return Response.json({error:{message:'Request too large'}},{status:413});assert.equal(body.max_tokens,2400);return Response.json({choices:[{message:{content:JSON.stringify({figures:[],guidance:[],people:[],notes:[]})}}]});};await extractDocument(d,{apiKey:'synthetic-test-key',fetchImpl});assert.equal(calls,2);
});
