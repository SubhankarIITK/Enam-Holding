// Only public NSE-imported documents are eligible for this demonstration run.
import nextEnv from '@next/env';nextEnv.loadEnvConfig(process.cwd());
const {researchDemos}=await import('../lib/demo-research.js');
const {getDocuments}=await import('../lib/backend.js');
const {extractCompanyDocument,companyInsights}=await import('../lib/company-insights.js');
try{
  for(const company of researchDemos){
    const docs=(await getDocuments(company.ticker)).filter(d=>d.importedFrom&&!d.demo&&d.url&&['nsearchives.nseindia.com','archives.nseindia.com'].includes(new URL(d.url).hostname)).sort((a,b)=>(b.publishedAt||b.period.replace('Filed ','')).localeCompare(a.publishedAt||a.period.replace('Filed ','')));
    for(const document of docs){let complete=false;for(let retry=0;retry<3&&!complete;retry++){try{const result=await extractCompanyDocument(company.ticker,document.id);console.log(JSON.stringify({ticker:company.ticker,period:document.period,cached:result.cached,figures:result.figures.length,guidance:result.guidance.length,notes:result.notes.length,rejected:result.rejected}));complete=true;if(!result.cached)await new Promise(resolve=>setTimeout(resolve,45000));}catch(e){console.log(JSON.stringify({ticker:company.ticker,status:e.status,code:e.code,retryAfter:e.retryAfter,error:e.message}));if(e.status!==429||e.retryAfter>120)break;await new Promise(resolve=>setTimeout(resolve,Math.max(30,e.retryAfter||60)*1000));}}}
    const insight=await companyInsights(company.ticker);console.log(JSON.stringify({ticker:company.ticker,analysed:insight.documents.filter(d=>d.extracted).length,total:insight.documents.length,figures:insight.figures.length,ratios:insight.ratios.length,quarterRows:insight.quarters.length,guidance:insight.guidance.length}));
  }
  process.exit(0);
}catch(e){console.log('Demo analysis stopped: '+e.name);process.exit(1);}
