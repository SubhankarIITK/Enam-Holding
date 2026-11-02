import test from 'node:test';
import assert from 'node:assert/strict';
import {samplePriceSeries,marketSeries,quarterlyComparison} from '../lib/charts.js';
import {companies,announcements} from '../lib/data.js';

test('sample series is labelled by company mode and never fills missing real history',()=>{
  const company=companies[0],series=samplePriceSeries(company);
  assert.equal(series.length,60);
  assert.ok(Math.abs(series.at(-1).close-company.price)<.00001);
  assert.ok(series.every(p=>Number.isFinite(p.close)&&p.volume>0));
  assert.deepEqual(samplePriceSeries({...company,demo:false}),[]);
  assert.deepEqual(samplePriceSeries({demo:true,price:null}),[]);
});

test('fetched chart series preserves dates, prices and volumes without inventing points',()=>{
  const rows=[{time:1792966500,close:123,volume:5000}];
  const series=marketSeries(rows);
  assert.equal(series.length,1);
  assert.equal(series[0].close,123);assert.equal(series[0].volume,5000);
  assert.match(series[0].date,/^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(marketSeries([]),[]);
});

test('financial plots keep year-ago, previous and current quarter values distinct',()=>{
  const data=quarterlyComparison(announcements[0].numbers,'Revenue');
  assert.deepEqual(data.map(p=>p.value),[39483,41600,42800]);
  assert.deepEqual(data.map(p=>p.label),['Year-ago Q','Prior Q','Current Q']);
  assert.deepEqual(quarterlyComparison(announcements[0].numbers,'Missing metric'),[]);
});
