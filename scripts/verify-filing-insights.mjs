import nextEnv from '@next/env';nextEnv.loadEnvConfig(process.cwd());
const {getRecord}=await import('../lib/repository.js');
const {filingInsights}=await import('../lib/company-insights.js');
const cases=[['management_change','nse-6b304217c0bfade44595ca58db7c2567'],['results','nse-d07079087b4eaa000092374952b46136']];
try{
  for(const [category,id]of cases){const filing=await getRecord('filings',id);if(!filing||filing.category!==category||new URL(filing.url).hostname!=='nsearchives.nseindia.com')throw new Error('Verified public filing is unavailable.');
    for(let attempt=0;attempt<5;attempt++)try{const d=await filingInsights(filing,{generate:true});console.log(JSON.stringify({category,ticker:filing.ticker,figures:d.figures.length,comparisons:d.comparisons.length,calculatedComparisons:d.comparisons.filter(r=>r.qoq!==null||r.yoy!==null).length,people:d.people.map(p=>({name:p.name,role:p.role,backgrounds:p.background.length})),warning:d.warning}));break;}catch(e){console.log(JSON.stringify({category,status:e.status,retryAfter:e.retryAfter,code:e.code}));if(e.status!==429||e.retryAfter>120)break;await new Promise(resolve=>setTimeout(resolve,Math.max(30,e.retryAfter||60)*1000));}
  }
  process.exit(0);
}catch(e){console.log('Public filing check stopped: '+e.name);process.exit(1);}
