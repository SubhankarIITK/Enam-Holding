import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTicker,percentChange,makeAlerts,filterAnnouncements,chunkText,retrieve,validateResearch} from '../lib/engine.js';
import {companies,announcements,defaultSettings,sampleDocuments} from '../lib/data.js';

test('ticker validation generalises beyond the demo and rejects malformed symbols',()=>{
  assert.equal(normalizeTicker(' m&m.ns '),'M&M');
  assert.equal(normalizeTicker('asianpaint'),'ASIANPAINT');
  for(const input of ['','https://localhost','../INFY','<script>','X'.repeat(26)]) assert.throws(()=>normalizeTicker(input));
});
test('financial comparisons handle zero and negative baselines explicitly',()=>{
  assert.equal(percentChange(110,100),10);
  assert.equal(percentChange(-50,-100),50);
  assert.equal(percentChange(30,0),null);
});
test('price alerts use absolute moves, volume alerts are inclusive, rules change results',()=>{
  const rows=[{ticker:'A',change:-3,volume:2,demo:true},{ticker:'B',change:2.9,volume:1.99}];
  assert.deepEqual(makeAlerts(rows,{priceThreshold:3,volumeThreshold:2}).map(a=>a.id),['price-A','volume-A']);
  assert.equal(makeAlerts(rows,{priceThreshold:4,volumeThreshold:3}).length,0);
  assert.ok(makeAlerts(companies,defaultSettings).length>0);
});
test('digest applies time window, category, company and search then sorts material first',()=>{
  assert.equal(filterAnnouncements(announcements,{hours:24}).some(a=>a.id==='a7'),false);
  assert.equal(filterAnnouncements(announcements,{hours:48,category:'credit_rating'})[0].id,'a7');
  assert.equal(filterAnnouncements(announcements,{ticker:'INFY',query:'margin'})[0].id,'a1');
  assert.equal(filterAnnouncements(announcements,{ticker:'TCS',query:'margin'}).length,0);
  assert.equal(filterAnnouncements(announcements)[0].priority,'high');
});
test('document chunks retain page provenance and retrieve guidance evidence',()=>{
  const chunks=chunkText('Revenue growth '.repeat(200),17);
  assert.ok(chunks.length>1);
  assert.ok(chunks.every(c=>c.page===17&&c.text.length<=1200));
  const sources=retrieve(sampleDocuments,'What did management promise versus deliver on guidance and margins?',2);
  assert.equal(sources.length,2);
  assert.equal(sources[0].documentId,'sample-call');
  assert.ok(sources.every(s=>s.citation&&s.page&&s.demo));
});
test('research rejects nonexistent, missing and inconsistent citations',()=>{
  const sources=[{citation:1}];
  assert.throws(()=>validateResearch({answer:'A claim [9]',citations:[9]},sources));
  assert.throws(()=>validateResearch({answer:'A claim',citations:[]},sources));
  assert.throws(()=>validateResearch({answer:'A claim [2]',citations:[1]},sources));
  assert.deepEqual(validateResearch({answer:'Evidence [1]',citations:[1]},sources),{answer:'Evidence [1]',citations:[1],insufficientEvidence:false});
  assert.equal(validateResearch({answer:'No cash flow evidence is available.',citations:[],insufficientEvidence:true},sources).insufficientEvidence,true);
});

test('research normalises grouped source references and reconciles redundant metadata',()=>{
  const sources=[{citation:1},{citation:2},{citation:3}];
  assert.deepEqual(validateResearch({answer:'Major changes [1, 2]. Outlook [Source 3].',citations:['1','2','3']},sources),{
    answer:'Major changes [1] [2]. Outlook [3].',citations:[1,2,3],insufficientEvidence:false
  });
  assert.equal(validateResearch({answer:'Compared figures [1–3]',citations:[]},sources).answer,'Compared figures [1] [2] [3]');
  assert.deepEqual(validateResearch({answer:'Supported finding [2]',citations:[1]},sources).citations,[2]);
  assert.deepEqual(validateResearch({answer:'Supported finding [1]'},sources).citations,[1]);
  assert.throws(()=>validateResearch({answer:'Unsupported reference [1, 9]',citations:[1]},sources));
  assert.throws(()=>validateResearch({answer:'Only a code example `[1]`',citations:[1]},sources));
  assert.throws(()=>validateResearch({answer:'No references.',citations:[],insufficientEvidence:'false'},sources));
  const liveVariant=validateResearch({answer:'## Major change\\n\\n**Margin:** fell to 20.6%【1】.\\n\\n- Outlook ［2］',citations:[1,2]},sources);
  assert.equal(liveVariant.answer,'## Major change\n\n**Margin:** fell to 20.6%[1].\n\n- Outlook [2]');
  assert.deepEqual(liveVariant.citations,[1,2]);
  assert.throws(()=>validateResearch({answer:'Invented reference【99】',citations:[1]},sources));
});
