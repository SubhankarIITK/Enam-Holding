import test from 'node:test';
import assert from 'node:assert/strict';
import {quarterlyPressRelease,quarterlyFinancialStatement,executiveProfiles,documentPages} from '../lib/filing-tables.js';
import {positionedText} from '../lib/document-ingestion.js';
import {annualTableFigures,statementFigures,explicitGrowthGuidance,reportingQuarter,enrichAnnualFigures} from '../lib/annual-table.js';
import {chunkText} from '../lib/engine.js';
import {financialComparisons} from '../lib/structured-finance.js';
const doc=(text,type='results')=>({id:'test-primary',ticker:'TEST',title:'Synthetic test disclosure',type,chunks:chunkText(text,1),publishedAt:'2025-07-20T00:00:00Z'});
test('direct quarterly tables calculate comparisons without confusing total income with revenue or half-year columns',()=>{
  const text='All amounts in INR crore. Standalone Particulars Q2 FY25-26 Q1 FY25-26 Q2 FY24-25 Q-o-Q Y-o-Y 6M FY25-26 Net profit 120 100 80 20% 50% 220 Consolidated Particulars Q2 FY25-26 Q1 FY25-26 Q2 FY24-25 Q-o-Q Y-o-Y 6M FY25-26 Total Income 300 250 200 20% 50% 550 Net profit 150 120 100 25% 50% 270';
  const rows=quarterlyPressRelease(doc(text));assert.equal(rows.length,9);assert.equal(rows.some(r=>r.metric==='Revenue'),false);assert.ok(rows.every(r=>r.periodType==='Quarter'));const comparison=financialComparisons(rows).find(r=>r.current.metric==='PAT'&&r.current.basis==='Consolidated'&&r.current.periodEnd==='2025-09-30');assert.equal(comparison.qoq,25);assert.equal(comparison.yoy,50);
  assert.equal(quarterlyPressRelease(doc(text.replaceAll('Q1 FY25-26','Q4 FY25-26'))).length,0);
});
test('executive profiles bind careers to the full named person and keep announced retirements distinct',()=>{
  const d=doc('Appointment of Mr. Jane Smith as an Independent Director Based on the recommendation, appointment is approved. 2. Retirement of Mr. John Brown as the Chairman The Company announces the retirement.','management_change');d.chunks.push({page:2,text:'Profiles Mr. Jane Smith Mr. Jane Smith is an engineer with 35 years of experience. Mr. Smith served at Example Ltd. He holds a degree in engineering. Mr. John Brown has 20 years of experience in retail.'});const p=executiveProfiles(d);assert.equal(p.length,2);assert.equal(p[0].background.length,1);assert.ok(p[0].background[0].text.includes('Example Ltd'));assert.ok(!p[0].background[0].text.includes('John Brown'));assert.equal(p[1].change,'retired');
});
test('annual summary parser requires explicit column order and preserves consolidated versus standalone accounts',()=>{
  const text='Financial Year ended March 31, 2025. INR crore. Particulars Consolidated Standalone FY 2024-25 FY 2023-24 FY 2024-25 FY 2023-24 Revenue from operations 100 90 80 70 Profit before Depreciation, Finance Costs and Tax Expense / EBITDA 20 18 16 14 Profit before tax (PBT) 15 13 11 9 Profit after tax for the year (PAT) 12 10 8 6';
  const rows=annualTableFigures(doc(text,'annual_report'));assert.equal(rows.length,16);assert.equal(rows.find(r=>r.metric==='Revenue'&&r.basis==='Standalone'&&r.periodEnd==='2025-03-31').value,80);assert.equal(annualTableFigures(doc(text.replace('Consolidated Standalone','Unspecified'),'annual_report')).length,0);
});
test('annual balance-sheet and cash-flow rows require explicit basis, currency and two adjacent years',()=>{
  const text='Consolidated Statement of Cash Flows INR crore March 31, 2025 March 31, 2024 Net cash generated from / (used in) operating activities (A) 120 100 Purchase of property, plant and equipment (30) (20) Purchase of intangible assets (5) (4)';const rows=statementFigures(doc(text,'annual_report'));assert.equal(rows.filter(r=>r.metric==='Operating cash flow').length,2);assert.equal(rows.find(r=>r.metric==='PPE purchases').value,-30);
  assert.equal(statementFigures(doc(text.replace('2024','2022'),'annual_report')).length,0);
});
test('explicit annual growth targets and reporting quarters remain distinct, including fiscal-year ranges',()=>{
  const d=doc('Q1 FY2025-26 Earnings Call. We are confident we can achieve 20% EBITDA growth for FY26 versus FY25.','transcript');const g=explicitGrowthGuidance(d);assert.equal(g.length,1);assert.equal(g[0].periodEnd,'2026-03-31');assert.equal(g[0].periodType,'Year');assert.equal(reportingQuarter(d).periodEnd,'2025-06-30');
  assert.equal(reportingQuarter(doc('Financial results for the quarter and half year ended September 30, 2025.','transcript')).periodEnd,'2025-09-30');assert.equal(reportingQuarter(doc('Filed October 30, 2025','transcript')),null);
});
test('page reconstruction removes known overlaps and evidence enrichment is stable across repeated reads',()=>{
  const text=('Revenue and annual financial statements. ').repeat(80),d=doc(text,'annual_report');assert.equal(documentPages(d)[0].text,text.trim());const e={figures:[],guidance:[],notes:[]};assert.deepEqual(enrichAnnualFigures(e,d),enrichAnnualFigures(e,d));
});
test('position ordering aligns slightly tilted table rows instead of attaching values to the next label',()=>{
  const item=(str,x,y)=>({str,transform:[1,0,0,1,x,y]}),text=positionedText([item('PBT',0,90),item('Revenue',0,100),item('80',300,102.9),item('120',100,101),item('100',200,102),item('20',100,91)]);assert.equal(text,'Revenue\t120\t100\t80\nPBT\t20');
});
test('full quarterly statements recognise exact calendar dates, preserve six-month separation and calculate current/prior/year-ago values',()=>{
  const d=doc('Statement of consolidated financial results for the quarter and six months ended September 30 , 2025 INR crore Quarter ended Six months ended Year ended Particulars Sep 30 , 2025 ) un 30 , 2025 Sep 30 , 2024 Sep 30 , 2025 Sep 30 , 2024 Mar 31 , 2025 Revenue from operations 120 100 80 220 160 400 Total Income 130 110 90 240 180 440 Profit before tax ( 1 - 2 ) 30 25 20 55 40 100 Net profit after tax ( 3 - 4 ) 24 20 16 44 32 80');const rows=quarterlyFinancialStatement(d);assert.equal(rows.length,12);assert.equal(rows.find(r=>r.metric==='Revenue'&&r.periodEnd==='2025-09-30').value,120);assert.equal(rows.some(r=>r.value===220),false);assert.equal(rows.find(r=>r.metric==='PBT'&&r.periodEnd==='2025-06-30').value,25);assert.equal(financialComparisons(rows)[0].qoq,20);
});
