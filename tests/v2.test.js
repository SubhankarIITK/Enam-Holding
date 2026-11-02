import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFinancialMetric} from '../lib/financial-metrics.js';
import {portfolioView} from '../lib/portfolio-view.js';
import {portfolioTickers,refreshPortfolio} from '../lib/portfolio-market.js';

const document={id:'primary',ticker:'TEST',title:'Synthetic test fixture',chunks:[{page:3,text:'Revenue for the current quarter was INR 1,234.50 crore, with EBITDA margin at 20.6%. All values are invented for this test.'}]};
const input={documentId:'primary',metric:'Revenue',unit:'INR crore',value:1234.5,page:3,quote:'Revenue for the current quarter was INR 1,234.50 crore',periodType:'Quarter',periodEnd:'2026-09-30',periodLabel:'Q2 FY27'};
test('financial figures require an exact source excerpt and exact numeric value',()=>{
  assert.equal(validateFinancialMetric(input,document).verification,'user-reviewed-excerpt-matched');
  assert.throws(()=>validateFinancialMetric({...input,value:234.5},document),/exact numeric/);
  assert.throws(()=>validateFinancialMetric({...input,quote:'Revenue was 9,999 crore in the current quarter.'},document),/must match/);
  assert.throws(()=>validateFinancialMetric({...input,page:2},document),/must match/);
  assert.throws(()=>validateFinancialMetric(input,{...document,demo:true}),/primary document/);
});
test('financial series keep period types and units separate and replace the same period',()=>{
  const first=validateFinancialMetric(input,document);
  assert.equal(first.id,validateFinancialMetric({...input,periodLabel:'Updated label'},document).id);
  assert.notEqual(first.id,validateFinancialMetric({...input,periodType:'Year'},document).id);
  assert.notEqual(first.id,validateFinancialMetric({...input,unit:'INR million'},document).id);
  assert.throws(()=>validateFinancialMetric({...input,periodEnd:'2026-02-30'},document),/valid period/);
  assert.throws(()=>validateFinancialMetric({...input,metric:'EBITDA margin'},document),/percent/);
  assert.throws(()=>validateFinancialMetric({...input,value:Infinity},document),/numeric/);
});
test('real mode never exposes synthetic portfolio prices or trend series',()=>{
  const companies=[{ticker:'TEST',demo:true,price:100,change:5,history:[1,2]}];
  const real=portfolioView(['TEST'],companies,{});assert.equal(real[0].price,null);assert.deepEqual(real[0].history,[]);assert.equal(real[0].demo,false);
  assert.equal(portfolioView(['TEST'],companies,{},'sample')[0].price,100);
  assert.equal(portfolioView(['TEST'],companies,{TEST:{price:200,demo:false}},'sample')[0].price,100);
});
test('bulk price refresh deduplicates tickers, bounds concurrency, and preserves partial failures',async()=>{
  let active=0,peak=0;
  const report=await refreshPortfolio(['A','B','C','D','E','A'],{fetchPrice:async ticker=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;if(ticker==='C')throw new Error('Private provider detail');return {ticker,price:10,demo:false};}});
  assert.equal(report.results.length,5);assert.equal(report.partial,true);assert.equal(peak,4);assert.equal(report.prices.A.price,10);assert.equal(report.prices.C,undefined);assert.ok(!JSON.stringify(report).includes('Private provider'));
  assert.deepEqual(portfolioTickers(['infy.NS','INFY']),['INFY']);assert.throws(()=>portfolioTickers(Array(41).fill('INFY')),/40/);
});
test('bulk price refresh reports stale data and skips work after its time budget',async()=>{
  let clock=0;const report=await refreshPortfolio(['A','B','C','D','E'],{now:()=>clock,fetchPrice:async ticker=>{clock=40000;return {ticker,stale:true};}});
  assert.equal(report.partial,true);assert.ok(report.results.some(r=>!r.ok));assert.ok(report.results.some(r=>r.stale));
});
