const hosts=new Set(['nsearchives.nseindia.com','archives.nseindia.com']);
export function exchangeDocumentUrl(value) {
  let url;try{url=new URL(value);}catch{throw new Error('Invalid exchange document URL.');}
  if(url.protocol!=='https:'||!hosts.has(url.hostname)||url.username||url.password||url.port||!url.pathname.toLowerCase().endsWith('.pdf'))throw new Error('Import supports PDF attachments on the NSE archive hosts only.');
  return url;
}
export async function downloadExchangePdf(value,{fetchImpl=pdfFetch,maxBytes=4000000}={}) {
  if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>24000000)throw new Error('Unsupported PDF download limit.');
  const sizeError=()=>new Error(`Exchange PDF exceeds ${maxBytes/1000000} MB. Download and split it before uploading.`);
  let url=exchangeDocumentUrl(value);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{
    for(let hop=0;hop<3;hop++){
      const response=await fetchImpl(url,{headers:{'User-Agent':'Mozilla/5.0',Referer:'https://www.nseindia.com/',Accept:'application/pdf'},redirect:'manual',signal:controller.signal,cache:'no-store'});
      if([301,302,303,307,308].includes(response.status)){await response.body?.cancel();url=exchangeDocumentUrl(new URL(response.headers.get('location')||'',url).href);continue;}
      if(!response.ok)throw new Error(`Exchange PDF download failed (HTTP ${response.status}).`);
      if(Number(response.headers.get('content-length')||0)>maxBytes){await response.body?.cancel();throw sizeError();}
      const reader=response.body.getReader(),buffers=[];let size=0;
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw sizeError();}buffers.push(Buffer.from(value));}
      return Buffer.concat(buffers);
    }
    throw new Error('Exchange PDF redirected too many times.');
  }catch(error){if(controller.signal.aborted)throw Object.assign(new Error('NSE PDF download timed out. Retry or open the original and upload it manually.'),{status:504});throw error;}finally{clearTimeout(timer);}
}
import {request as httpsRequest} from 'node:https';
import {Readable} from 'node:stream';
// Keep large PDF streams outside Next's patched fetch/cache instrumentation.
function pdfFetch(url,{headers,signal}){
  return new Promise((resolve,reject)=>{
    const request=httpsRequest(url,{method:'GET',headers,signal},response=>{
      try{const responseHeaders=new Headers();for(const [name,value] of Object.entries(response.headers))if(value!==undefined)responseHeaders.set(name,Array.isArray(value)?value.join(', '):value);
        const status=response.statusCode||502;resolve(new Response([204,304].includes(status)?null:Readable.toWeb(response),{status,headers:responseHeaders}));
      }catch(error){response.destroy();reject(error);}
    });request.on('error',reject);request.end();
  });
}
