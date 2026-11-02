export function requestError(message,status=400){return Object.assign(new Error(message),{status});}
export async function boundedBytes(message,maxBytes){
  if(Number(message.headers.get('content-length')||0)>maxBytes)throw requestError('Request or response exceeds the size limit.',413);
  if(!message.body)return new Uint8Array();
  const reader=message.body.getReader(),parts=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw requestError('Request or response exceeds the size limit.',413);}parts.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}return bytes;
}
export async function readJson(request,maxBytes=12000){
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw requestError('Send an application/json request.',415);
  const text=new TextDecoder().decode(await boundedBytes(request,maxBytes));
  let body;try{body=JSON.parse(text);}catch{throw requestError('Request contains malformed JSON.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw requestError('Send a JSON object.');
  return body;
}
export async function responseJson(response,maxBytes=2000000){
  try{return JSON.parse(new TextDecoder().decode(await boundedBytes(response,maxBytes)));}
  catch(error){if(error.status===413)throw requestError('Provider response exceeded the size limit.',502);throw requestError('Provider returned an unreadable response.',502);}
}
export function sameOrigin(request){
  const origin=request.headers.get('origin');if(!origin)return true;
  try{const expected=new URL(process.env.FINN_APP_URL||request.url);if(!process.env.FINN_APP_URL){const host=request.headers.get('host');if(host)expected.host=host;if(process.env.VERCEL&&request.headers.get('x-forwarded-proto'))expected.protocol=request.headers.get('x-forwarded-proto').split(',')[0].trim()+':';}return origin===expected.origin;}
  catch{return false;}
}
