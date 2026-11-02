// Idempotent primary-source preparation. Does not change the portfolio or remove documents.
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const {discoverSources}=await import('../lib/source-discovery.js');
const {importPrimary}=await import('../lib/import-primary.js');
const {researchDemos,researchDemoStatus}=await import('../lib/demo-research.js');
const {getDocuments}=await import('../lib/backend.js');
const {putRecord}=await import('../lib/repository.js');
try{
  for(const demo of researchDemos){
    console.log(`Preparing ${demo.ticker} primary sources...`);
    const catalog=await discoverSources(demo.ticker),chosen=catalog.candidates.filter(c=>c.type==='annual_report').slice(0,4),calls=[];
    for(const candidate of catalog.candidates.filter(c=>c.type==='transcript').sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))){if(calls.every(c=>Math.abs(Date.parse(c.publishedAt)-Date.parse(candidate.publishedAt))>45*86400000))calls.push(candidate);if(calls.length===4)break;}
    chosen.push(...calls);const existing=await getDocuments(demo.ticker);let annualReady=0;
    for(const candidate of chosen){if(candidate.type==='annual_report'&&annualReady>=2)continue;if(existing.some(d=>d.url===candidate.url)){if(candidate.type==='annual_report')annualReady++;console.log(`  Already stored: ${candidate.period}`);continue;}
      try{const result=await importPrimary(candidate);if(candidate.type==='annual_report')annualReady++;console.log(`  Imported ${candidate.type} ${candidate.period}: ${result.pages} pages`);}catch{console.log(`  Import unavailable: ${candidate.type} ${candidate.period}. Retry or upload the original.`);}}
  }
  const status=await researchDemoStatus();await putRecord('workspace','research-demo',{companies:status,preparedAt:new Date().toISOString()});
  console.log(JSON.stringify(status.map(({ticker,annualReports,transcripts,ready})=>({ticker,annualReports,transcripts,ready}))));process.exit(status.every(s=>s.ready)?0:1);
}catch(e){console.log('Demo preparation stopped: '+(e.status||e.name));process.exit(1);}
