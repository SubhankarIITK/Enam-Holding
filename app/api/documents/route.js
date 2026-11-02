import {boundedBytes} from '@/lib/http';
import {createHash} from 'node:crypto';
import {parsePrimaryPdf} from '@/lib/document-ingestion';
import {storageConfig} from '@/lib/repository';
import {authorize,getDocuments,saveDocument,errorResponse} from '@/lib/server';
import {normalizeTicker,chunkText} from '@/lib/engine';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request) {
  const denied=await authorize(request);if(denied) return denied;
  try {
    const ticker=normalizeTicker(new URL(request.url).searchParams.get('ticker'));
    const docs=await getDocuments(ticker);
    return Response.json({documents:docs.map(({chunks,...d})=>({...d,pages:new Set(chunks.map(c=>c.page)).size,chunks:chunks.length}))});
  } catch(e) {return errorResponse(e);}
}
export async function POST(request) {
  const denied=await authorize(request);if(denied) return denied;
  try {
    if(Number(request.headers.get('content-length')||0)>4300000) return Response.json({error:'Upload a PDF smaller than 4 MB.'},{status:413});
    const bytes=await boundedBytes(request,4300000);
    const form=await new Request(request.url,{method:'POST',headers:request.headers,body:bytes}).formData();
    const ticker=normalizeTicker(form.get('ticker'));
    const title=String(form.get('title')||'').trim().slice(0,160);
    const type=String(form.get('type'));
    const period=String(form.get('period')||'').trim().slice(0,40);
    if(!title||!period||!['annual_report','transcript'].includes(type)) throw new Error('Add a title, period and supported document type.');
    const source=String(form.get('url')||'').trim();
    let url=null;
    if(source) {try {url=new URL(source);if(url.protocol!=='https:'||url.username||url.password) throw 0;url=url.href;}catch{throw new Error('Source link must be a valid HTTPS URL.');}}
    const file=form.get('file');
    let chunks=[],original=null,quality=null;
    if(file && typeof file.arrayBuffer==='function' && file.size) {
      if(file.size>4000000) return Response.json({error:'PDF limit is 4 MB. Split a large report into sections.'},{status:413});
      const buffer=Buffer.from(await file.arrayBuffer());
      const parsed=await parsePrimaryPdf(buffer);
      chunks=parsed.chunks;quality=parsed.quality;original=buffer;
    } else {
      const text=String(form.get('text')||'');
      if(text.length>300000) throw new Error('Pasted text limit is 300,000 characters.');
      // Form-feed separated text preserves manually supplied page boundaries.
      chunks=text.split('\f').flatMap((page,i)=>chunkText(page,i+1));
    }
    if(chunks.reduce((n,c)=>n+c.text.length,0)<100) throw new Error('Not enough extractable text. Use a text-based PDF or paste the relevant primary-source excerpt. Scanned PDFs require OCR.');
    if(chunks.length>1200) throw new Error('Document is too long. Upload relevant sections separately.');
    const hash=createHash('sha256').update(ticker+type+period+chunks.map(c=>c.text).join('')).digest('hex').slice(0,24);
    const document={id:hash,ticker,title,type,period,url,chunks,demo:false,createdAt:new Date().toISOString(),quality};
    const saved=await saveDocument(document,original);
    return Response.json({id:hash,title,pages:new Set(chunks.map(c=>c.page)).size,chunks:chunks.length,storage:storageConfig().mode,hasOriginal:saved.hasOriginal,quality});
  } catch(e) {return errorResponse(e);}
}
