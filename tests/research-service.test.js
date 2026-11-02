import test from 'node:test';
import assert from 'node:assert/strict';
import {generateResearch} from '../lib/research-service.js';

const sources=[{citation:1,title:'Annual report',period:'FY26',page:1,text:'Synthetic annual revenue was 100 crore.'},{citation:2,title:'Transcript',period:'Q2 FY27',page:2,text:'Synthetic quarterly margin fell from 22% to 20%.'}];
const options={ticker:'INFY',question:'what is the major chnage',sources,apiKey:'test-placeholder',model:'test-model'};
const completion=raw=>Response.json({choices:[{message:{content:JSON.stringify(raw)}}]});

test('the reported major-change question recovers from missing inline citations automatically',async()=>{
  const calls=[];
  const result=await generateResearch({...options,fetchImpl:async(url,init)=>{
    const request=JSON.parse(init.body);calls.push(structuredClone(request));
    return calls.length===1?completion({answer:'Illustrative margin fell from 22% to 20%.',citations:[2],insufficientEvidence:false}):completion({answer:'**Major change:** Illustrative margin fell from 22% to 20%. [2]',citations:[2],insufficientEvidence:false});
  }});
  assert.equal(calls.length,2);
  assert.equal(JSON.parse(calls[0].messages[1].content).question,options.question);
  assert.match(calls[1].messages.at(-1).content,/missing inline evidence/);
  assert.deepEqual(result.citations,[2]);
  assert.match(result.answer,/\[2\]/);
});

test('valid grouped references succeed without spending a repair request',async()=>{
  let calls=0;
  const result=await generateResearch({...options,fetchImpl:async()=>{calls++;return completion({answer:'Illustrative financial changes [1, 2]',citations:[1,2]});}});
  assert.equal(calls,1);assert.equal(result.answer,'Illustrative financial changes [1] [2]');
});

test('the live Groq Unicode bracket and escaped-newline variant succeeds without repair',async()=>{
  let calls=0;
  const result=await generateResearch({...options,fetchImpl:async()=>{calls++;return completion({answer:'## Major change\\n\\n**Margin:** fell from 22% to 20%【2】.',citations:[2]});}});
  assert.equal(calls,1);
  assert.equal(result.answer,'## Major change\n\n**Margin:** fell from 22% to 20%[2].');
  assert.deepEqual(result.citations,[2]);
});

test('invented source IDs are still rejected after the bounded repair',async()=>{
  let calls=0;
  await assert.rejects(()=>generateResearch({...options,fetchImpl:async()=>{calls++;return completion({answer:'Invented evidence [99]',citations:[99]});}}),/could not verify/);
  assert.equal(calls,2);
});

test('rate limits are reported immediately without a repair request',async()=>{
  let calls=0;
  await assert.rejects(()=>generateResearch({...options,fetchImpl:async()=>{calls++;return new Response('',{status:429});}}),/rate limit/);
  assert.equal(calls,1);
});


test('Groq daily quotas return an actionable 429 and bounded retry time',async()=>{
  await assert.rejects(()=>generateResearch({...options,fetchImpl:async()=>Response.json({error:{message:'Tokens per day quota exceeded for private-org-id'}},{status:429,headers:{'Retry-After':'90'}})}),e=>e.status===429&&e.code==='GROQ_RATE_LIMIT'&&e.retryAfter===90&&/daily quota/.test(e.message)&&!e.message.includes('private-org-id'));
});
