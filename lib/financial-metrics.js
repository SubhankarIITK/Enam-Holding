import {createHash} from 'node:crypto';

export const financialMetricNames=['Revenue','PAT','PBT','EBITDA','Operating cash flow','Capital expenditure','Total debt','Cash balance','EBITDA margin'];
const clean=text=>String(text||'').normalize('NFKC').replace(/\s+/g,' ').trim();
export function validateFinancialMetric(input,document){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Add financial figure fields.');
  if(!document||document.demo||document.id!==input.documentId)throw new Error('Select a stored primary document.');
  if(!financialMetricNames.includes(input.metric))throw new Error('Select a supported financial metric.');
  if(!['INR crore','INR million','INR billion','USD million','%'].includes(input.unit))throw new Error('Select the unit printed in the source.');
  if((input.metric==='EBITDA margin')!==(input.unit==='%'))throw new Error('Use percent for EBITDA margin and a currency unit for financial amounts.');
  if(!['Quarter','Year','As of'].includes(input.periodType))throw new Error('Select a period type.');
  const date=String(input.periodEnd||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Enter a valid period-end date.');
  if(typeof input.value!=='number'||!Number.isFinite(input.value)||Math.abs(input.value)>1e12)throw new Error('Enter a valid numeric figure.');
  const page=Number(input.page),chunks=document.chunks.filter(c=>c.page===page),quote=clean(input.quote);
  if(!Number.isInteger(page)||!chunks.length||quote.length<20||quote.length>2000||!chunks.some(c=>clean(c.text).includes(quote)))throw new Error('The supporting excerpt must match text on the selected document page (20–2,000 characters).');
  const tokens=quote.replaceAll('−','-').match(/[+-]?\d[\d,]*(?:\.\d+)?/g)||[];
  if(!tokens.some(token=>Number(token.replaceAll(',',''))===input.value))throw new Error('The exact numeric value must appear in the supporting excerpt. Do not convert units.');
  const periodLabel=clean(input.periodLabel);
  if(periodLabel.length<2||periodLabel.length>40)throw new Error('Add a short period label, for example Q2 FY27.');
  const record={ticker:document.ticker,documentId:document.id,metric:input.metric,unit:input.unit,value:input.value,page,quote,periodType:input.periodType,periodEnd:date,periodLabel,title:document.title,url:document.url,hasOriginal:!!document.hasOriginal,verification:'user-reviewed-excerpt-matched',updatedAt:new Date().toISOString()};
  record.id=createHash('sha256').update([record.ticker,record.metric,record.unit,record.periodType,record.periodEnd].join('|')).digest('hex').slice(0,32);
  return record;
}
