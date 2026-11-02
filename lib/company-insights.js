import {getDocuments} from './backend.js';
import {readExtraction,extractDocument} from './insight-extraction.js';
import {financialComparisons,derivedRatios,guidanceTrack} from './structured-finance.js';
import {getRecord,getCached,setCached,singleFlight} from './repository.js';
import {downloadExchangePdf} from './source-import.js';
import {parsePrimaryPdf} from './document-ingestion.js';
import {enrichAnnualFigures} from './annual-table.js';
import {quarterlyPressRelease,quarterlyFinancialStatement,executiveProfiles} from './filing-tables.js';
export async function insightDocument(document){
  if(document.publishedAt||!document.importedFrom)return document;
  const source=await getRecord('researchSources',document.importedFrom);return {...document,publishedAt:source?.publishedAt||null};
}
export function assembleInsights(ticker,extractions,documents=[]){
  // Prefer explicit accounting basis; never merge units or periods. Conflicting reports remain visible.
  const figures=[],conflicts=[],seen=new Map();
  for(const extraction of extractions)for(const figure of extraction.figures){const key=[figure.metric,figure.unit,figure.basis,figure.periodType,figure.periodEnd,figure.basis==='Unspecified'?figure.source.documentId:''].join('|'),existing=seen.get(key);if(existing){if(existing.value!==figure.value)conflicts.push({metric:figure.metric,periodEnd:figure.periodEnd,values:[existing,figure]});continue;}seen.set(key,figure);figures.push(figure);}
  const guidance=extractions.flatMap(e=>e.guidance),comparisons=financialComparisons(figures),track=guidanceTrack(figures,guidance),reportingPeriods=extractions.map(e=>e.reportingPeriod).filter(Boolean),ends=[...new Set([...figures.filter(f=>f.periodType==='Quarter').map(f=>f.periodEnd),...reportingPeriods.map(p=>p.periodEnd)])].filter(end=>Date.parse(end)<=Date.now()).sort().reverse();
  // Show four actual calendar quarters including gaps, rather than skipping missing quarters.
  const latest=ends[0],quarters=latest?Array.from({length:4},(_,i)=>{const d=new Date(latest);return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-i*3+1,0)).toISOString().slice(0,10);}):[];
  return {ticker,documents:documents.map(d=>({id:d.id,title:d.title,type:d.type,period:d.period,publishedAt:d.publishedAt||null,extracted:extractions.some(e=>e.documentId===d.id&&!e.partial)})),figures,comparisons,ratios:derivedRatios(figures),guidance:track,quarters:quarters.map(periodEnd=>({periodEnd,promises:track.filter(r=>(r.promise.periodType==='Quarter'&&r.promise.periodEnd===periodEnd)||reportingPeriods.some(p=>p.periodEnd===periodEnd&&p.source.documentId===r.promise.source.documentId)),actuals:figures.filter(f=>f.periodType==='Quarter'&&f.periodEnd===periodEnd),reportingSource:reportingPeriods.find(p=>p.periodEnd===periodEnd)?.source||null,commentary:extractions.filter(e=>e.reportingPeriod?.periodEnd===periodEnd).flatMap(e=>e.notes.filter(n=>['narrative','outlook'].includes(n.section))).slice(0,2)})),notes:extractions.flatMap(e=>e.notes),conflicts,rejected:extractions.reduce((n,e)=>n+e.rejected,0),generatedAt:new Date().toISOString()};
}
export async function companyInsights(ticker){const documents=(await getDocuments(ticker)).filter(d=>!d.demo),prepared=await Promise.all(documents.map(insightDocument));const rank=d=>d.publishedAt?.slice(0,10)||(/FY\s*(\d{4})[-/](\d{2,4})/i.test(d.period)?`${String(d.period.match(/FY\s*(\d{4})[-/](\d{2,4})/i)[2]).padStart(4,'20')}-03-31`:'0000');prepared.sort((a,b)=>rank(b).localeCompare(rank(a)));const extractions=await Promise.all(prepared.map(async d=>(await readExtraction(d))||enrichAnnualFigures({documentId:d.id,figures:[],guidance:[],notes:[],rejected:0,partial:true},d)));return assembleInsights(ticker,extractions,prepared);}
export async function extractCompanyDocument(ticker,id){const document=await getRecord('documents',id);if(!document||document.ticker!==ticker||document.demo||!['annual_report','transcript'].includes(document.type))throw Object.assign(new Error('Select a stored primary document for this company.'),{status:404});return extractDocument(await insightDocument(document));}
export async function filingInsights(filing,{generate=false}={}){
  if(!['results','management_change'].includes(filing.category))throw new Error('This filing does not support results or executive analysis.');
  const key=`filing-insight-${filing.category==='results'?'v5':'v3'}-`+filing.id,cached=await getCached(key);if(cached)return cached.value;if(!generate)return null;
  return singleFlight(key,async()=>{
    let chunks,warning='';
    try{const buffer=await downloadExchangePdf(filing.url,{maxBytes:24000000});const parsed=await parsePrimaryPdf(buffer,{maxBytes:24000000,maxPages:1200,spatial:filing.category==='results'});if(parsed.chunks.length>6000||Buffer.byteLength(JSON.stringify(parsed.chunks),'utf8')>12000000)throw new Error('Attachment text limit exceeded.');chunks=parsed.chunks;}catch{chunks=[{page:1,text:filing.sourceText||filing.summary||''}];warning='The PDF could not be read. Only the exchange announcement text was analysed.';}
    const document={id:filing.id,ticker:filing.ticker,title:filing.title,type:filing.category,period:'Filed '+filing.publishedAt.slice(0,10),publishedAt:filing.publishedAt,url:filing.url,chunks,hasOriginal:false};
    const figures=[...quarterlyPressRelease(document),...quarterlyFinancialStatement(document)],people=executiveProfiles(document),parsed=figures.length||people.length;
    const extraction=parsed?{documentId:document.id,figures,people,guidance:[],notes:[],rejected:0,notice:'Read directly from explicit filing tables and named appointment/profile sections. Check the original disclosure before relying on them.'}:await extractDocument(document),result={...assembleInsights(filing.ticker,[extraction]),people:extraction.people,warning,notice:extraction.notice};
    await setCached(key,result,warning?600000:30*86400000);return result;
  });
}
