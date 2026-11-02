import {validateExtraction} from './structured-finance.js';
import {retrieve} from './retrieval.js';
import {createHash} from 'node:crypto';
import {documentPages} from './filing-tables.js';
const parsedEvidence=new Map();
export function statementFigures(document){
  if(document.type!=='annual_report')return [];
  const output=[],amount='(\\(?-?[\\d,]+(?:\\.\\d+)?\\)?)',values=`\\s+(?:\\d{1,2}[a-z]?\\s+)?${amount}\\s+${amount}(?=\\s|$)`;
  const specs=[['Revenue','Revenue from operations'],['PBT','Profit before tax(?:ation)?'],['PAT','Profit for the year(?: \\([A-Z +]+\\))?|Profit after tax'],['Operating cash flow','Net cash[^0-9]{0,80}operating activities(?: \\([A-Z]\\))?'],['Capital expenditure','Capital expenditure'],['PPE purchases','Purchase of property,? plant and equipment'],['Intangible purchases','Purchase of intangible assets'],['Cash balance','Cash and cash equivalents'],['Equity','Total equity'],['Total assets','Total assets'],['Current assets','Total current assets'],['Current liabilities','Total current liabilities'],['Inventory','Inventories'],['Receivables','Trade receivables'],['Payables','Total trade payables'],['Total debt','Total (?:borrowings|debt)']];
  for(const page of documentPages(document)){
    const header=page.text.slice(0,1100),title=header.match(/(Consolidated|Standalone)\s+(?:Balance Sheet|Statement of (?:Cash|Profit))/i);if(!title)continue;
    const basis=title[1].toLowerCase()==='consolidated'?'Consolidated':'Standalone',unit=/crore/i.test(header)?'INR crore':/lakh/i.test(header)?'INR lakh':/million/i.test(header)&&/INR|Rs\.?|₹/i.test(header)?'INR million':null;if(!unit)continue;
    const dates=[...header.matchAll(/(?:31[\s,-]+March|March\s+31[,]?)\s*(20\d{2})/gi)].map(m=>Number(m[1]));
    const years=[...new Set(dates)].slice(0,2);if(years.length!==2||years[0]-years[1]!==1)continue;
    const evidence={documentId:document.id,ticker:document.ticker,title:document.title,url:document.url,page:page.page,period:document.period,text:page.text,hasOriginal:!!document.hasOriginal,citation:1};
    for(const [metric,label]of specs){const row=page.text.match(new RegExp(`(?:${label})${values}`,'i'));if(!row)continue;const periodType=['Cash balance','Equity','Total assets','Current assets','Current liabilities','Inventory','Receivables','Payables','Total debt'].includes(metric)?'As of':'Year';
      const figures=years.map((year,i)=>({metric,value:Number(row[i+1].replaceAll(',','').replace(/[()]/g,''))*(row[i+1].startsWith('(')?-1:1),unit,basis,periodType,periodEnd:`${year}-03-31`,periodLabel:periodType==='Year'?`FY${year}`:`March ${year}`,citation:1,quote:row[0],context:header}));output.push(...validateExtraction({figures,guidance:[],people:[],notes:[]},[evidence]).figures);
    }
  }
  return [...new Map(output.map(f=>[[f.metric,f.basis,f.periodEnd].join('|'),f])).values()];
}
// A deliberately narrow parser for an explicit four-column annual summary.
// Unrecognised layouts are left to extraction, never guessed into these columns.
export function annualTableFigures(document){
  if(document.type!=='annual_report')return [];
  const output=[];
  for(const chunk of document.chunks||[]){
    const text=chunk.text.normalize('NFKC').replace(/\s+/g,' ').trim();
    const heading=text.match(/Particulars\s+Consolidated\s+Standalone\s+((?:FY\s+\d{4}\s*[-/]\s*\d{2,4}\s*){4})/i);
    if(!heading||!/crore/i.test(text)||!/March\s+31,?\s+\d{4}/i.test(text))continue;
    const periods=[...heading[1].matchAll(/FY\s+(\d{4})\s*[-/]\s*(\d{2,4})/gi)].map(m=>{const year=Number(m[2])+(m[2].length===2?2000:0);return {end:`${year}-03-31`,label:`FY${m[1]}-${m[2]}`};});
    if(periods.length!==4||periods[0].end!==periods[2].end||periods[1].end!==periods[3].end||Number(periods[0].end.slice(0,4))-Number(periods[1].end.slice(0,4))!==1)continue;
    const amount='(\\(?-?[\\d,]+(?:\\.\\d+)?\\)?)',values=`\\s+${amount}\\s+${amount}\\s+${amount}\\s+${amount}(?=\\s|$)`;
    const patterns=[['Revenue','Revenue from operations'],['EBITDA','Profit before Depreciation, Finance Costs and Tax Expense / EBITDA'],['PBT','Profit before tax \\(PBT\\)'],['PAT','Profit after tax for the year \\(PAT\\)']];
    for(const [metric,label]of patterns){const match=text.match(new RegExp(label+values,'i'));if(!match)continue;
      const source={documentId:document.id,ticker:document.ticker,title:document.title,period:document.period,url:document.url,page:chunk.page,text,citation:1,hasOriginal:!!document.hasOriginal};
      const rows=periods.map((period,i)=>({metric,value:Number(match[i+1].replaceAll(',','').replace(/[()]/g,''))*(match[i+1].startsWith('(')?-1:1),unit:'INR crore',basis:i<2?'Consolidated':'Standalone',periodType:'Year',periodEnd:period.end,periodLabel:period.label,citation:1,quote:match[0],context:heading[0]}));
      output.push(...validateExtraction({figures:rows,guidance:[],people:[],notes:[]},[source]).figures);
    }
  }
  return [...new Map(output.map(f=>[[f.metric,f.basis,f.periodEnd].join('|'),f])).values()];
}
export function supportingNotes(document){
  if(!['annual_report','transcript'].includes(document.type))return [];
  const topics=[['business','business products principal activities manufacturing services segments customers',/manufactur|provides|principal activit|business model|segments|products/i],['risk','risk competition uncertainty commodity credit currency cybersecurity',/risk|competit|uncertain|adverse/i],['balance','balance sheet borrowings debt liquidity funding',/borrowings|\bdebt\b|liquidity|balance sheet/i],['cash','operating cash flow cash conversion working capital',/cash flow|cash from|working capital/i],['narrative','management performance demand margin strategy',/management|performance|demand|margin|strategy/i],['outlook','expect opportunity expansion guidance target future outlook',/expect|opportun|expan|\bwill\b|target|outlook/i]];
  return topics.flatMap(([section,question,required])=>{const candidate=retrieve([document],question,5).find(s=>required.test(s.text));if(!candidate)return [];const text=candidate.text.slice(0,700),stop=text.lastIndexOf('.'),quote=stop>160?text.slice(0,stop+1):text;return [{section,source:{documentId:document.id,ticker:document.ticker,title:document.title,url:document.url,page:candidate.page,period:document.period,text:quote,hasOriginal:!!document.hasOriginal}}];});
}
export function reportingQuarter(document){
  if(document.type!=='transcript')return null;
  const months={march:3,june:6,september:9,december:12},sourceFor=(chunk,text)=>({documentId:document.id,ticker:document.ticker,title:document.title,page:chunk.page,url:document.url,period:document.period,text,hasOriginal:!!document.hasOriginal});
  for(const chunk of document.chunks.slice(0,20)){const match=chunk.text.replace(/\s+/g,' ').match(/quarter[^.!?]{0,50}ended\s+(March|June|September|December)\s+(30|31),?\s+(20\d{2})/i);if(match){const month=months[match[1].toLowerCase()],year=Number(match[3]),end=`${year}-${String(month).padStart(2,'0')}-${match[2]}`;if(new Date(end).toISOString().slice(0,10)===end)return {periodEnd:end,periodLabel:`Quarter ended ${end}`,source:sourceFor(chunk,match[0])};}}
  for(const chunk of document.chunks.slice(0,20)){const match=chunk.text.match(/\bQ([1-4])\s*FY\s*['’]?(\d{2,4})(?:\s*[-/]\s*(\d{2,4}))?\b/i);if(!match)continue;const fy=Number(match[3]||match[2])+(String(match[3]||match[2]).length===2?2000:0),q=Number(match[1]),month={1:6,2:9,3:12,4:3}[q],year=q===4?fy:fy-1;return {periodEnd:new Date(Date.UTC(year,month,0)).toISOString().slice(0,10),periodLabel:`Q${q} FY${fy}`,source:sourceFor(chunk,match[0])};}
  return null;
}
export function explicitGrowthGuidance(document){
  if(!['annual_report','transcript'].includes(document.type))return [];
  const output=[],amount='(\\d+(?:\\.\\d+)?)',range=`${amount}(?:\\s*(?:to|[-–])\\s*${amount})?`,pattern=new RegExp(`(?:expect|guidance|target|aim|confident)[^.!?]{0,240}?${range}\\s*%\\s+(?:and above\\s+)?(EBITDA|revenue|sales|PAT|PBT)\\s+growth\\s+(?:(?:for|in|during)\\s+)?FY\\s*['’]?(\\d{2,4})`,'gi');
  for(const chunk of document.chunks){const text=chunk.text.normalize('NFKC').replace(/\s+/g,' ').trim();for(const match of text.matchAll(pattern)){
    if(/\bQ[1-4]\s*FY/i.test(match[0])||/at least|more than|and above|up to|less than|below/i.test(match[0]))continue;const fy=Number(match[4])+(match[4].length===2?2000:0),metric=match[3].toLowerCase()==='sales'?'Revenue':match[3].toLowerCase()==='revenue'?'Revenue':match[3].toUpperCase(),low=Number(match[1]),high=Number(match[2]||match[1]);
    const source={documentId:document.id,ticker:document.ticker,title:document.title,url:document.url,page:chunk.page,period:document.period,text,citation:1,hasOriginal:!!document.hasOriginal};
    const validated=validateExtraction({figures:[],people:[],notes:[],guidance:[{metric,measure:'yoy-growth',low,high,unit:'%',basis:/consolidated/i.test(text)?'Consolidated':'Unspecified',periodType:'Year',periodEnd:`${fy}-03-31`,periodLabel:`FY${fy}`,citation:1,quote:match[0],context:match[0]}]},[source],{publishedAt:document.publishedAt});output.push(...validated.guidance);
  }}
  return [...new Map(output.map(g=>[[g.metric,g.periodEnd,g.low,g.high].join('|'),g])).values()];
}
export function enrichAnnualFigures(extraction,document){const key=createHash('sha256').update(JSON.stringify({id:document.id,publishedAt:document.publishedAt,chunks:document.chunks})).digest('hex');let parsed=parsedEvidence.get(key);if(!parsed){parsed={figures:[...annualTableFigures(document),...statementFigures(document)],notes:supportingNotes(document),guidance:explicitGrowthGuidance(document),reportingPeriod:reportingQuarter(document)};if(parsedEvidence.size>=60)parsedEvidence.delete(parsedEvidence.keys().next().value);parsedEvidence.set(key,parsed);}const figures=[...parsed.figures,...extraction.figures.filter(f=>f.metric!=='Capital expenditure'||/capex|capital expenditure|capital spending/i.test(f.source.text))],notes=[...(extraction.notes||[])],guidance=[...(extraction.guidance||[]),...parsed.guidance];for(const note of parsed.notes)if(!notes.some(n=>n.section===note.section))notes.push(note);return {...extraction,notes,reportingPeriod:parsed.reportingPeriod,guidance:[...new Map(guidance.map(g=>[[g.metric,g.periodEnd,g.measure,g.basis,g.low,g.high,g.source.page].join('|'),g])).values()],figures:[...new Map(figures.map(f=>[[f.metric,f.unit,f.basis,f.periodType,f.periodEnd,f.value].join('|'),f])).values()]};}
