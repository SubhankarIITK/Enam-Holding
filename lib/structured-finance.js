// Source checks and arithmetic are deterministic; the model only proposes records.
export const metrics=['Revenue','Total income','EBITDA','PBT','PAT','Operating cash flow','Capital expenditure','PPE purchases','Intangible purchases','Total debt','Cash balance','Equity','EBIT','Total assets','Current assets','Current liabilities','Inventory','Receivables','Payables','EBITDA margin'];
export const units=['INR crore','INR lakh','INR million','INR billion','USD million','USD billion','%'];
const clean=s=>String(s||'').normalize('NFKC').replaceAll('−','-').replace(/\s+/g,' ').trim();
const metricTerms={Revenue:/revenue|sales|income from operations/i,'Total income':/total income/i,EBITDA:/ebitda|earnings before interest.*depreciation/i,PBT:/pbt|profit.*before.*tax/i,PAT:/pat\b|profit.*after.*tax|net profit|profit.*period|profit.*year/i,'Operating cash flow':/cash.*operat|operat.*cash/i,'Capital expenditure':/capex|capital expenditure|capital spending/i,'PPE purchases':/purchase.*property|payments.*property/i,'Intangible purchases':/purchase.*intangible|payments.*intangible/i,'Total debt':/borrowings|total debt|gross debt/i,'Cash balance':/cash.*equivalent|cash balance|cash on books/i,Equity:/equity|net worth/i,EBIT:/\bebit\b|earnings before interest and tax/i,'Total assets':/total assets/i,'Current assets':/current assets/i,'Current liabilities':/current liabilities/i,Inventory:/inventor/i,Receivables:/receivable/i,Payables:/payable/i,'EBITDA margin':/ebitda.*margin|margin.*ebitda/i};
export function numberInQuote(value,quote){const text=clean(quote).replace(/(\d)\s*[-–]\s*(?=\d)/g,'$1 to ');return [...text.matchAll(/[+-]?\d[\d,]*(?:\.\d+)?/g)].some(match=>{const token=match[0],accounting=/\(\s*$/.test(text.slice(0,match.index)),n=Number(token.replaceAll(',',''))*(accounting?-1:1);return Math.abs(n-value)<1e-8;});}
export function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function periodSupported(end,type,text){
  if(!validDate(end))return false;const t=clean(text).replace(/\)\s*un(?=\s+\d)/g,'Jun'),date=new Date(end),year=date.getUTCFullYear(),month=date.getUTCMonth()+1,day=date.getUTCDate();
  if(t.includes(end))return true;
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const numeric=new RegExp(`\\b${day}[./-]0?${month}[./-](?:${year}|${String(year).slice(-2)})\\b`);
  const words=new RegExp(`(?:\\b${months[month-1]}[a-z]*[.,]?\\s+${day}(?:st|nd|rd|th)?\\s*[.,]?\\s+${year}\\b|\\b${day}(?:st|nd|rd|th)?[\\s-]+${months[month-1]}[a-z]*[.,]?[\\s-]+${year}\\b)`,'i');
  if(numeric.test(t)||words.test(t))return true;
  const fiscal=[...t.matchAll(/\bFY\s*['’]?(\d{2,4})(?:\s*[-/]\s*(\d{2,4}))?/gi)].map(m=>Number(m[2]||m[1])+(String(m[2]||m[1]).length===2?2000:0));
  const fy=month<=3?year:year+1,q={6:1,9:2,12:3,3:4}[month];
  if(type==='Year')return month===3&&day===31&&fiscal.includes(year);
  return type==='Quarter'&&[30,31].includes(day)&&fiscal.includes(fy)&&new RegExp(`\\bQ${q}\\b|quarter\\s*${q}\\b`,'i').test(t);
}
function evidence(raw,sources,minLength=12){
  const source=sources.find(s=>s.citation===raw?.citation),quote=clean(raw?.quote);
  if(!source||quote.length<minLength||quote.length>3500||!clean(source.text).includes(quote))return null;
  return {documentId:source.documentId,ticker:source.ticker,title:source.title,url:source.url,period:source.period,page:source.page,text:quote,hasOriginal:source.hasOriginal||false,citation:source.citation};
}
function unitSupported(unit,text){const t=clean(text);if(unit.startsWith('USD')&&!/USD|US\$|dollar/i.test(t))return false;if(unit.startsWith('INR')&&/USD|US\$|dollar/i.test(t)&&!/INR|Rs\.?|₹|rupee/i.test(t))return false;return unit==='%'?/%|percent|per cent|bps|basis points/i.test(t):unit==='INR crore'?/crore|\bcr\b/i.test(t):unit==='INR lakh'?/lakh|\blacs?\b/i.test(t):unit.endsWith('million')?/million|\bmn\b|\bmillion[s]?\b/i.test(t):/billion|\bbn\b/i.test(t);}
export function validateExtraction(raw,sources,{publishedAt=null}={}){
  if(!raw||typeof raw!=='object'||!['figures','guidance','people','notes'].every(k=>Array.isArray(raw[k])))throw new Error('The document response is incomplete. Please retry.');
  const figures=[],guidance=[],people=[],notes=[];let rejected=0;
  for(const row of raw.figures.slice(0,48)){
    if(!row||typeof row!=='object'){rejected++;continue;}
    const source=evidence(row,sources),context=clean(row.context),passage=sources.find(s=>s.citation===row.citation)?.text||'',contextSource=evidence({citation:row.contextCitation||row.citation,quote:row.context},sources,4),basis=['Consolidated','Standalone','Unspecified'].includes(row.basis)?row.basis:'Unspecified';
    if(!source||!metrics.includes(row.metric)||!Number.isFinite(row.value)||Math.abs(row.value)>1e13||!numberInQuote(row.value,source.text)||!metricTerms[row.metric].test(source.text)||!units.includes(row.unit)||!contextSource||!periodSupported(row.periodEnd,row.periodType,context)||!['Quarter','Year','As of'].includes(row.periodType)||!unitSupported(row.unit,passage+' '+context)||(basis!=='Unspecified'&&!new RegExp(basis,'i').test(passage+' '+context))||((row.metric==='EBITDA margin')!==(row.unit==='%'))){rejected++;continue;}
    if(row.periodEnd>new Date().toISOString().slice(0,10)){rejected++;continue;}
    figures.push({metric:row.metric,value:row.value,unit:row.unit,basis,periodEnd:row.periodEnd,periodType:row.periodType,periodLabel:String(row.periodLabel||row.periodEnd).slice(0,40),source:{...source,contextSource},context,verification:'automatic-excerpt-matched'});
  }
  for(const row of raw.guidance.slice(0,16)){
    if(!row||typeof row!=='object'){rejected++;continue;}
    const source=evidence(row,sources),context=clean(row.context),passage=sources.find(s=>s.citation===row.citation)?.text||'',contextSource=evidence({citation:row.contextCitation||row.citation,quote:row.context},sources,4);
    if(!source||!metrics.includes(row.metric)||!['absolute','yoy-growth'].includes(row.measure)||!Number.isFinite(row.low)||!Number.isFinite(row.high)||row.low>row.high||!numberInQuote(row.low,source.text)||!numberInQuote(row.high,source.text)||(row.low===row.high&&/at least|more than|and above|up to|less than|below/i.test(source.text))||!metricTerms[row.metric].test(source.text)||!/expect|guid|target|aim|outlook|anticipat|forecast|project|maintain|achiev|confident/i.test(source.text)||!contextSource||!periodSupported(row.periodEnd,row.periodType,context)||!units.includes(row.unit)||!unitSupported(row.unit,passage+' '+context)||(row.measure==='yoy-growth'&&row.unit!=='%')||(row.measure==='absolute'&&(row.metric==='EBITDA margin')!==(row.unit==='%'))){rejected++;continue;}
    guidance.push({metric:row.metric,measure:row.measure,low:row.low,high:row.high,unit:row.unit,basis:['Consolidated','Standalone'].includes(row.basis)?row.basis:'Unspecified',periodType:row.periodType,periodEnd:row.periodEnd,periodLabel:String(row.periodLabel||row.periodEnd).slice(0,40),issuedAt:publishedAt&&validDate(publishedAt.slice(0,10))?publishedAt.slice(0,10):null,source:{...source,contextSource},context});
  }
  for(const row of raw.people.slice(0,6)){
    if(!row||typeof row!=='object'){rejected++;continue;}
    const source=evidence(row,sources),name=clean(row.name),role=clean(row.role);
    if(!source||name.length<3||name.length>100||role.length<3||role.length>160||!clean(source.text).toLowerCase().includes(name.toLowerCase())||!clean(source.text).toLowerCase().includes(role.toLowerCase())||!['appointed','resigned','retired'].includes(row.change)){rejected++;continue;}
    const background=(Array.isArray(row.background)?row.background:[]).slice(0,5).map(b=>evidence(b,sources)).filter(s=>s&&clean(s.text).toLowerCase().includes(name.toLowerCase()));people.push({name,role,change:row.change,source,background});
  }
  for(const row of raw.notes.slice(0,20)){if(!row||typeof row!=='object'){rejected++;continue;}const source=evidence(row,sources);if(source&&['business','risk','balance','cash','narrative','outlook'].includes(row.section))notes.push({section:row.section,source});else rejected++;}
  return {figures,guidance,people,notes,rejected};
}
const same=(a,b)=>a.metric===b.metric&&a.unit===b.unit&&a.basis===b.basis&&a.periodType===b.periodType&&(a.basis!=='Unspecified'||a.source.documentId===b.source.documentId);
export function change(current,previous){return !Number.isFinite(current)||!Number.isFinite(previous)||previous<=0?null:(current-previous)/previous*100;}
function previousEnd(end,quarters){const d=new Date(end),month=d.getUTCMonth()-quarters*3;return new Date(Date.UTC(d.getUTCFullYear(),month+1,0)).toISOString().slice(0,10);}
export function financialComparisons(figures){return figures.filter(f=>f.periodType==='Quarter'&&['Revenue','Total income','EBITDA','PBT','PAT'].includes(f.metric)).map(current=>{const prior=figures.find(f=>same(f,current)&&f.periodEnd===previousEnd(current.periodEnd,1)),yearAgo=figures.find(f=>same(f,current)&&f.periodEnd===previousEnd(current.periodEnd,4));return {current,prior:prior||null,yearAgo:yearAgo||null,qoq:change(current.value,prior?.value),yoy:change(current.value,yearAgo?.value)};}).sort((a,b)=>b.current.periodEnd.localeCompare(a.current.periodEnd));}
export function derivedRatios(figures){
  const output=[],find=(metric,base)=>figures.find(f=>f.metric===metric&&f.periodEnd===base.periodEnd&&f.periodType===base.periodType&&f.unit===base.unit&&f.basis===base.basis&&(base.basis!=='Unspecified'||f.source.documentId===base.source.documentId));
  const specs=[['EBITDA margin','EBITDA','Revenue',100,'%'],['Cash conversion','Operating cash flow','PAT',100,'%'],['Debt / equity','Total debt','Equity',1,'x'],['Current ratio','Current assets','Current liabilities',1,'x']];
  for(const [metric,n,d,multiplier,unit]of specs)for(const numerator of figures.filter(f=>f.metric===n&&(metric!=='ROE (closing equity)'||f.periodType==='Year'))){const denominator=find(d,numerator);if(denominator?.value>0)output.push({metric,value:numerator.value/denominator.value*multiplier,unit,periodEnd:numerator.periodEnd,periodType:numerator.periodType,basis:numerator.basis,inputs:[numerator,denominator],formula:`${n} / ${d}${multiplier===100?' × 100':''}`});}
  for(const operating of figures.filter(f=>f.metric==='Operating cash flow')){const capex=find('Capital expenditure',operating),ppe=find('PPE purchases',operating),intangible=find('Intangible purchases',operating),spends=capex?[capex]:ppe&&intangible?[ppe,intangible]:[];if(spends.length)output.push({metric:'Free cash flow',value:operating.value-spends.reduce((n,s)=>n+Math.abs(s.value),0),unit:operating.unit,periodEnd:operating.periodEnd,periodType:operating.periodType,basis:operating.basis,inputs:[operating,...spends],formula:capex?'Operating cash flow - absolute capital expenditure cash outflow':'Operating cash flow - absolute PPE purchases - absolute intangible purchases'});}
  const stock=(metric,end,base)=>figures.find(f=>f.metric===metric&&f.periodEnd===end&&['Year','As of'].includes(f.periodType)&&f.unit===base.unit&&f.basis===base.basis&&(base.basis!=='Unspecified'||f.source.documentId===base.source.documentId));
  for(const flow of figures.filter(f=>f.periodType==='Year'&&['PAT','EBIT'].includes(f.metric))){const previous=previousEnd(flow.periodEnd,4);let inputs=[flow],denominator;
    if(flow.metric==='PAT'){const current=stock('Equity',flow.periodEnd,flow),prior=stock('Equity',previous,flow);if(current&&prior){denominator=(current.value+prior.value)/2;inputs.push(current,prior);}}
    else{const ac=stock('Total assets',flow.periodEnd,flow),ap=stock('Total assets',previous,flow),lc=stock('Current liabilities',flow.periodEnd,flow),lp=stock('Current liabilities',previous,flow);if(ac&&ap&&lc&&lp){denominator=((ac.value-lc.value)+(ap.value-lp.value))/2;inputs.push(ac,ap,lc,lp);}}
    if(denominator>0)output.push({metric:flow.metric==='PAT'?'ROE (average equity)':'ROCE (average capital)',value:flow.value/denominator*100,unit:'%',periodEnd:flow.periodEnd,periodType:'Year',basis:flow.basis,inputs,formula:flow.metric==='PAT'?'Annual PAT / average opening and closing equity × 100':'Annual EBIT / average (total assets - current liabilities) × 100'});
  }
  return output;
}
export function guidanceTrack(figures,guidance,{now=Date.now()}={}){
  return guidance.map(promise=>{
    const actual=figures.find(f=>f.metric===promise.metric&&f.periodType===promise.periodType&&f.periodEnd===promise.periodEnd&&f.basis===promise.basis&&(promise.measure==='yoy-growth'?f.unit!=='%':f.unit===promise.unit)&&(f.basis!=='Unspecified'||f.source.documentId===promise.source.documentId));
    let value=actual?.value,inputs=actual?[actual]:[];
    if(actual&&promise.measure==='yoy-growth'){const prior=figures.find(f=>same(f,actual)&&f.periodEnd===previousEnd(actual.periodEnd,4));value=change(actual.value,prior?.value);if(prior)inputs.push(prior);}
    let status='Awaiting reported outcome';
    if(Date.parse(promise.periodEnd)>now)status='Future period';
    else if(!promise.issuedAt)status='Guidance publication date unavailable';
    else if(promise.issuedAt>promise.periodEnd)status='Guidance was published after the target period';
    else if(actual&&Number.isFinite(value))status=value<promise.low?'Below guidance':value>promise.high?'Above guidance':'Within guidance';
    else if(actual)status='Prior-year evidence missing';
    return {promise,actual:actual||null,value:Number.isFinite(value)?value:null,inputs,status};
  }).sort((a,b)=>b.promise.periodEnd.localeCompare(a.promise.periodEnd));
}
