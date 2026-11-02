import {createRequire} from 'node:module';
import {chunkText} from './engine.js';

export function positionedText(items){
  const rows=[];for(const item of [...items].filter(i=>i.str&&i.transform).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){const y=item.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<4);if(!row){row={y,items:[]};rows.push(row);}row.items.push(item);}
  return rows.sort((a,b)=>b.y-a.y).map(r=>r.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join('\t')).join('\n');
}
export async function parsePrimaryPdf(buffer,{maxBytes=4000000,maxPages=400,spatial=false}={}) {
  if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>24000000)throw new Error('Unsupported PDF extraction limit.');
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>1200)throw new Error('Unsupported PDF page limit.');
  if(buffer.length>maxBytes)throw Object.assign(new Error(`PDF limit is ${maxBytes/1000000} MB. Split a large report into sections.`),{status:413});
  if(!buffer.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('The uploaded file is not a PDF.');
  const require=createRequire(import.meta.url),parse=require('pdf-parse/lib/pdf-parse.js');
  const chunks=[],lowTextPages=[];let pageNumber=0;
  const result=await parse(buffer,{max:maxPages,pagerender:async page=>{
    const number=Number.isInteger(page.pageIndex)?page.pageIndex+1:++pageNumber;
    const content=await page.getTextContent();let lastY=null,text='';
    if(spatial)text=positionedText(content.items);
    else for(const item of content.items){const y=item.transform?.[5];text+=(lastY!==null&&y!==undefined&&Math.abs(y-lastY)>3?'\n':text?'\t':'')+item.str;lastY=y;}
    if(text.trim().length<50)lowTextPages.push(number);
    chunks.push(...chunkText(text,number));return '';
  }});
  if(result.numpages>maxPages)throw new Error(`PDF exceeds ${maxPages} pages. Split it into sections so no pages are silently omitted.`);
  return {chunks,quality:{pages:result.numpages,lowTextPages,ocrRequired:lowTextPages.length>0}};
}
