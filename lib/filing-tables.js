import {validateExtraction} from './structured-finance.js';
const clean=t=>String(t).normalize('NFKC').replace(/\s+/g,' ').trim();
export function documentPages(document){const pages=new Map();for(const c of document.chunks){const old=pages.get(c.page)||'';let overlap=old&&c.text.length>=200&&old.endsWith(c.text.slice(0,200))?200:0;if(old&&!overlap)for(let n=Math.min(300,old.length,c.text.length);n>=20;n--)if(old.endsWith(c.text.slice(0,n))){overlap=n;break;}pages.set(c.page,old+(old&&!overlap?'\n':'')+c.text.slice(overlap));}return [...pages].map(([page,text])=>({page,text:clean(text)}));}
const source=(d,p,text)=>({documentId:d.id,ticker:d.ticker,title:d.title,url:d.url,period:d.period,page:p.page,text,hasOriginal:!!d.hasOriginal});
export function quarterlyPressRelease(document){
  const output=[];
  for(const page of documentPages(document)){
    if(!/crore/i.test(page.text))continue;
    const sections=[...page.text.matchAll(/\b(Standalone|Consolidated)\s+Particulars\b/gi)];
    for(let index=0;index<sections.length;index++){
      const start=sections[index].index,end=sections[index+1]?.index||page.text.length,text=page.text.slice(start,end),basis=sections[index][1].toLowerCase()==='consolidated'?'Consolidated':'Standalone';
      const columns=[...text.matchAll(/\bQ([1-4])\s*FY\s*(\d{2,4})(?:\s*[-/]\s*(\d{2,4}))?/gi)].slice(0,3);
      if(columns.length!==3)continue;
      const periods=columns.map(m=>{const fy=Number(m[3]||m[2])+(String(m[3]||m[2]).length===2?2000:0),q=Number(m[1]),month={1:6,2:9,3:12,4:3}[q];return {end:new Date(Date.UTC(q===4?fy:fy-1,month,0)).toISOString().slice(0,10),label:`Q${q} FY${fy}`};});
      const first=new Date(periods[0].end),prior=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()-2,0)).toISOString().slice(0,10),yearAgo=new Date(Date.UTC(first.getUTCFullYear()-1,first.getUTCMonth()+1,0)).toISOString().slice(0,10);
      if(periods[1].end!==prior||periods[2].end!==yearAgo)continue;
      const amount='(\\(?-?[\\d,]+(?:\\.\\d+)?\\)?)',values=`\\s+${amount}\\s+${amount}\\s+${amount}(?=\\s|$)`;
      const specs=[['Revenue','Revenue from operations|Revenue|Sales'],['Total income','Total Income'],['EBITDA','EBITDA'],['PBT','Profit before tax|PBT'],['PAT','Net profit|Profit after tax|PAT']];
      const firstRow=text.search(/Total Income|Revenue|Sales|Net profit|Profit before tax|EBITDA/i);if(firstRow<0)continue;const header=text.slice(0,firstRow);
      for(const [metric,label]of specs){const row=text.match(new RegExp(`(?:${label})${values}`,'i'));if(!row)continue;const evidence={...source(document,page,page.text),citation:1};
        const figures=periods.map((p,i)=>({metric,value:Number(row[i+1].replaceAll(',','').replace(/[()]/g,''))*(row[i+1].startsWith('(')?-1:1),basis,unit:'INR crore',periodType:'Quarter',periodEnd:p.end,periodLabel:p.label,citation:1,quote:row[0],context:header}));output.push(...validateExtraction({figures,guidance:[],people:[],notes:[]},[evidence]).figures);
      }
    }
  }
  return [...new Map(output.map(f=>[[f.metric,f.basis,f.periodEnd].join('|'),f])).values()];
}
export function quarterlyFinancialStatement(document){
  const output=[],months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12},amount='(\\(?-?[\\d,]+(?:\\.\\d+)?\\)?)';
  for(const page of documentPages(document)){
    const header=page.text.slice(0,1600),accounts=header.match(/statement of (standalone|consolidated) financial results/i);if(!accounts||!/Quarter\s+Ended/i.test(header))continue;
    const basis=accounts[1].toLowerCase()==='standalone'?'Standalone':'Consolidated',unit=/crore/i.test(header)?'INR crore':/lakh|lacs/i.test(header)?'INR lakh':null;if(!unit)continue;
    const dates=[];for(const m of header.matchAll(/(Jan[a-z]*|Feb[a-z]*|Mar[a-z]*|Apr[a-z]*|May|Jun[a-z]*|\)\s*un|Jul[a-z]*|Aug[a-z]*|Sep[a-z]*|Oct[a-z]*|Nov[a-z]*|Dec[a-z]*)\s+(\d{1,2})\s*,?\s*(20\d{2})/gi)){const key=m[1].toLowerCase().replace(/\)\s*un/,'jun').slice(0,3),end=`${m[3]}-${String(months[key]).padStart(2,'0')}-${m[2].padStart(2,'0')}`;if(!dates.includes(end))dates.push(end);}
    if(dates.length<3)continue;const periods=dates.slice(0,3),first=new Date(periods[0]);if(Number.isNaN(first.getTime()))continue;
    const previous=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()-2,0)).toISOString().slice(0,10),yearAgo=new Date(Date.UTC(first.getUTCFullYear()-1,first.getUTCMonth()+1,0)).toISOString().slice(0,10);if(periods[1]!==previous||periods[2]!==yearAgo)continue;
    const formula='(?:\\s*[f({][^(){}]{0,20}[})])?',values=`${formula}\\s+${amount}\\s+${amount}\\s+${amount}(?=\\s|$)`;
    const specs=[['Revenue','Revenue from operations'],['Total income','Total Income'],['EBITDA','EBITDA'],['PBT','Profit before tax'],['PAT','Net profit after tax|Profit after tax|Profit for the period']];
    for(const [metric,label]of specs){const match=page.text.match(new RegExp(`(?:${label})${values}`,'i'));if(!match)continue;const evidence={...source(document,page,page.text),citation:1},figures=periods.map((periodEnd,i)=>({metric,value:Number(match[i+1].replaceAll(',','').replace(/[()]/g,''))*(match[i+1].startsWith('(')?-1:1),unit,basis,periodEnd,periodLabel:`Quarter ended ${periodEnd}`,periodType:'Quarter',citation:1,quote:match[0],context:header}));output.push(...validateExtraction({figures,guidance:[],people:[],notes:[]},[evidence]).figures);}
  }
  return [...new Map(output.map(f=>[[f.metric,f.basis,f.periodEnd].join('|'),f])).values()];
}
export function executiveProfiles(document){
  const pages=documentPages(document),people=[];
  const pattern=/(A\s*ppoint\s*ment|R\s*etirement|R\s*esignation)\s+of\s+(?:M\s*r\s*\.|M\s*s\s*\.|Mrs\s*\.)\s*([A-Z][A-Za-z. ]{3,80}?)\s+as\s+(?:a\s*n?|the)\s+([A-Z][A-Za-z -]{3,100}?)(?=\s*\(|\s+Based\b|\s+Consequent\b|\s+The\s+Company\b|\s+\d\.\s|\s+with\s+effect|$)/gi;
  for(const page of pages)for(const match of page.text.matchAll(pattern)){
    const name=match[2].trim(),role=match[3].trim();if(!name||!role||people.some(p=>p.name===name&&p.role===role))continue;
    people.push({name,role,change:match[1].replace(/\s/g,'').toLowerCase()==='appointment'?'appointed':match[1].replace(/\s/g,'').toLowerCase()==='retirement'?'retired':'resigned',source:source(document,page,match[0]),background:[]});
  }
  const profilePages=pages.filter(p=>/\bProfiles?\b/i.test(p.text)&&/experience|career|degree|served|partner|qualification/i.test(p.text));
  for(const person of people)for(const profile of profilePages){const start=profile.text.indexOf(person.name);if(start<0)continue;let end=Math.min(profile.text.length,start+1500);for(const other of people.filter(p=>p.name!==person.name)){const next=profile.text.indexOf(other.name,start+person.name.length);if(next>start&&next<end)end=next;}
    let quote=profile.text.slice(start,end).trim().replace(/\bM\s*[rs]\s*\.\s*$/i,'').trim();const sentence=quote.lastIndexOf('.');if(sentence>120)quote=quote.slice(0,sentence+1);if(quote.includes(person.name)&&/experience|career|degree|served|partner|qualif/i.test(quote))person.background.push(source(document,profile,quote));
  }
  return people;
}
