import {createHash} from 'node:crypto';
import {saveDocument} from './backend.js';
import {downloadExchangePdf} from './source-import.js';
import {parsePrimaryPdf} from './document-ingestion.js';
export async function importPrimary(source,{period=source.period,download=downloadExchangePdf,parse=parsePrimaryPdf,save=saveDocument}={}){
  if(!['annual_report','transcript'].includes(source.type)||!period)throw new Error('Select an annual report or transcript and its period.');
  const original=await download(source.url,{maxBytes:24000000}),parsed=await parse(original,{maxBytes:24000000,maxPages:1200});
  if(parsed.chunks.reduce((sum,c)=>sum+c.text.length,0)<100)throw new Error('This PDF has too little text. It may need OCR before upload.');
  if(parsed.chunks.length>6000||Buffer.byteLength(JSON.stringify(parsed.chunks),'utf8')>12000000)throw new Error('This document exceeds the text-index limit. Download and split it before uploading.');
  const hash=createHash('sha256').update(source.ticker+source.type+period+parsed.chunks.map(c=>c.text).join('')).digest('hex').slice(0,24),retained=original.length<=4000000;
  const document=await save({id:hash,ticker:source.ticker,title:source.title,type:source.type,period,url:source.url,publishedAt:source.publishedAt||null,chunks:parsed.chunks,demo:false,quality:parsed.quality,createdAt:new Date().toISOString(),importedFrom:source.id,sourceSha256:createHash('sha256').update(original).digest('hex'),sourceBytes:original.length,originalPolicy:retained?'stored':'source-link'},retained?original:null);
  return {id:hash,ticker:document.ticker,title:document.title,pages:document.pages,chunks:document.chunkCount,hasOriginal:document.hasOriginal,quality:parsed.quality,originalPolicy:document.originalPolicy,notice:retained?'Original PDF and extracted text saved.':'Extracted text saved. This PDF is over 4 MB; open the original at its NSE source link.'};
}
