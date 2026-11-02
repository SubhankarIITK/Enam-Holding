import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExtraction,numberInQuote,periodSupported,financialComparisons,derivedRatios,guidanceTrack} from '../lib/structured-finance.js';
import {assembleInsights} from '../lib/company-insights.js';
import {selectEvidence,insightKey} from '../lib/insight-extraction.js';
import {researchEvidence} from '../lib/retrieval.js';
import {checkedResearchFacts} from '../lib/research-facts.js';
const source={documentId:'test-primary',ticker:'TEST',citation:1,page:2,title:'Synthetic unit-test financial statement',url:'https://example.com/test.pdf',text:'Consolidated Q2 FY26. INR crore. Revenue 120. EBITDA 30. Profit before tax 20. PAT 16.'};
const row={metric:'Revenue',value:120,unit:'INR crore',basis:'Consolidated',periodType:'Quarter',periodLabel:'Q2 FY26',periodEnd:'2025-09-30',citation:1,quote:'Revenue 120.',context:source.text};
const raw=figures=>({figures,guidance:[],people:[],notes:[]});
const figure=(metric,value,periodEnd='2025-09-30',options={})=>({metric,value,periodEnd,periodLabel:periodEnd,periodType:'Quarter',unit:'INR crore',basis:'Consolidated',source,...options});
test('automatic figures must match exact evidence, printed values, dates, metrics and units',()=>{
  assert.equal(validateExtraction(raw([row]),[source]).figures.length,1);
  for(const change of [{value:1200},{metric:'PAT'},{unit:'INR million'},{periodEnd:'2025-06-30'},{basis:'Standalone'},{quote:'Revenue was 120.'},{context:'Q2 FY26. INR crore but fabricated context'}])assert.equal(validateExtraction(raw([{...row,...change}]),[source]).figures.length,0,JSON.stringify(change));
  assert.equal(numberInQuote(-100,'Revenue (100)'),true);assert.equal(numberInQuote(100,'Revenue (100)'),false);assert.equal(numberInQuote(10,'Guidance 8-10%'),true);assert.equal(numberInQuote(100,'Loss -100'),false);
  assert.ok(periodSupported('2025-09-30','Quarter','Q2 FY26'));
  assert.equal(periodSupported('2025-09-30','Year','FY26'),false);
  assert.equal(periodSupported('2026-03-31','Year','FY2025-26'),true);
});
test('a separate exact heading citation can establish the period without inventing it',()=>{
  const numberSource={...source,text:'Consolidated revenue for the quarter was INR 120 crore.'},heading={...source,citation:2,page:1,text:'Q2 FY26 Earnings Call - Consolidated accounts'};
  const r=validateExtraction(raw([{...row,quote:numberSource.text,context:heading.text,contextCitation:2}]),[numberSource,heading]);assert.equal(r.figures.length,1);assert.equal(r.figures[0].source.contextSource.page,1);
});
test('results comparisons use exact quarter adjacency, basis and units, and avoid misleading negative-base percentages',()=>{
  const current=figure('Revenue',120),prior=figure('Revenue',100,'2025-06-30'),year=figure('Revenue',80,'2024-09-30');
  const r=financialComparisons([current,prior,year])[0];assert.equal(r.qoq,20);assert.equal(r.yoy,50);
  assert.equal(financialComparisons([current,{...prior,basis:'Standalone'},{...year,unit:'INR million'}])[0].qoq,null);
  assert.equal(financialComparisons([current,{...prior,value:-100}])[0].qoq,null);
});
test('ratios expose source inputs; FCF recognises signed capex; ROE requires opening and closing equity',()=>{
  const f=(m,v,end='2025-03-31',type='Year')=>figure(m,v,end,{periodType:type});
  const rows=[f('PAT',100),f('Operating cash flow',120),f('Capital expenditure',-30),f('Equity',500,undefined,'As of'),f('Equity',300,'2024-03-31','As of'),f('EBIT',150),f('Total assets',1000,undefined,'As of'),f('Total assets',800,'2024-03-31','As of'),f('Current liabilities',200,undefined,'As of'),f('Current liabilities',100,'2024-03-31','As of')];
  const ratios=derivedRatios(rows);assert.equal(ratios.find(r=>r.metric==='Cash conversion').value,120);assert.equal(ratios.find(r=>r.metric==='Free cash flow').value,90);assert.equal(ratios.find(r=>r.metric==='ROE (average equity)').value,25);assert.equal(ratios.find(r=>r.metric==='ROCE (average capital)').value,20);
  assert.ok(ratios.every(r=>r.inputs.length>=2));assert.equal(derivedRatios(rows.filter(f=>f.periodEnd!=='2024-03-31')).some(r=>r.metric==='ROE (average equity)'),false);
});
test('guidance requires explicit targets, publication timing and comparable outcomes',()=>{
  const promise={metric:'Revenue',measure:'yoy-growth',low:15,high:25,unit:'%',basis:'Consolidated',periodType:'Quarter',periodEnd:'2025-09-30',issuedAt:'2025-07-15',source};
  const figures=[figure('Revenue',120),figure('Revenue',100,'2024-09-30')];const result=guidanceTrack(figures,[promise]);assert.equal(result[0].value,20);assert.equal(result[0].status,'Within guidance');
  assert.equal(guidanceTrack(figures,[{...promise,issuedAt:'2025-10-01'}])[0].status,'Guidance was published after the target period');
  assert.equal(guidanceTrack(figures,[{...promise,issuedAt:null}])[0].status,'Guidance publication date unavailable');
  assert.equal(guidanceTrack(figures.slice(0,1),[promise])[0].status,'Prior-year evidence missing');
  const text='We expect Revenue growth of 8-10% for Q3 FY26. Consolidated outlook.';const s={...source,text};const extraction=validateExtraction({...raw([]),guidance:[{...promise,periodEnd:'2025-12-31',low:8,high:10,citation:1,quote:text,context:text}]},[s],{publishedAt:'2025-07-15T00:00:00Z'});assert.equal(extraction.guidance.length,1);
});
test('executive profiles require the named person and exclude unrelated biographies',()=>{
  const text='Jane Doe appointed as Chief Financial Officer. Jane Doe previously worked at Example Ltd. John Smith has an MBA.';const s={...source,text};const payload={...raw([]),people:[{name:'Jane Doe',role:'Chief Financial Officer',change:'appointed',citation:1,quote:'Jane Doe appointed as Chief Financial Officer.',background:[{citation:1,quote:'Jane Doe previously worked at Example Ltd.'},{citation:1,quote:'John Smith has an MBA.'}]}]};const r=validateExtraction(payload,[s]);assert.equal(r.people.length,1);assert.equal(r.people[0].background.length,1);
});
test('four-quarter view preserves gaps, annual guidance stays outside quarterly rows and conflicts remain visible',()=>{
  const figures=[figure('Revenue',120),figure('Revenue',80,'2025-03-31')],a={figures,guidance:[],notes:[],rejected:0},b={...a,figures:[{...figures[0],value:121}]};const r=assembleInsights('TEST',[a,b]);assert.deepEqual(r.quarters.map(q=>q.periodEnd),['2025-09-30','2025-06-30','2025-03-31','2024-12-31']);assert.equal(r.quarters[1].actuals.length,0);assert.equal(r.conflicts.length,1);
});
test('evidence selection is bounded, includes explicit quarter headings and cache invalidates edited sources',()=>{
  const d={id:'test',ticker:'TEST',title:'Test',type:'transcript',chunks:[{page:1,text:'Q2 FY26 Earnings Conference Call - Consolidated accounts'},...Array.from({length:30},(_,i)=>({page:i+2,text:('Revenue EBITDA PAT growth cash guidance '+i+' ').repeat(60)}))]};const s=selectEvidence(d);assert.ok(s.length<=10);assert.ok(s.reduce((n,p)=>n+p.text.length,0)<=12000);assert.match(s[0].text,/Q2 FY26/);assert.notEqual(insightKey(d),insightKey({...d,chunks:[...d.chunks,{page:99,text:'New results'}]}));
});
test('financial research includes source tables rather than only recurring audit boilerplate',()=>{
  const d={id:'financial-test',ticker:'TEST',title:'Synthetic annual report',type:'annual_report',chunks:[...Array.from({length:20},(_,i)=>({page:i+1,text:'Audit matters. Financial performance financial statements financial year audit opinion.'})),{page:30,text:'FINANCIAL SUMMARY INR crore FY2025-26 Revenue 120 EBITDA 30 PBT 20 PAT 16.'}]};const sources=researchEvidence([d],'Analyse financial performance over the last three years.');assert.ok(sources.some(s=>s.page===30));assert.equal(sources[0].page,30);assert.ok(sources.length<=10);assert.ok(sources.every((s,i)=>s.citation===i+1));
});
test('checked research facts distinguish operating revenue from total income and preserve the requested accounting basis',()=>{
  const text='Financial Year ended March 31, 2025. INR crore. Particulars Consolidated Standalone FY 2024-25 FY 2023-24 FY 2024-25 FY 2023-24 Revenue from operations 100 90 80 70 Total Income 110 99 88 77';const document={id:'facts-test',ticker:'TEST',type:'annual_report',title:'Synthetic report',chunks:[{page:1,text}]},sources=[{documentId:document.id,page:1,text,citation:1}];const facts=checkedResearchFacts([document],sources,'Summarise revenue.');assert.equal(facts[0].value,100);assert.equal(facts.some(f=>f.value===110),false);assert.equal(facts.every(f=>f.basis==='Consolidated'),true);assert.equal(checkedResearchFacts([document],sources,'Show standalone revenue.')[0].value,80);assert.equal(checkedResearchFacts([document],[]).length,0);
});
