import {createHash,randomUUID} from 'node:crypto';
import {sampleDocuments} from './data.js';
import {database,getRecord,queryRecords,putRecord,saveOriginal,consumeQuota} from './repository.js';
import {equalSecret,validSession} from './session.js';
import {sameOrigin} from './http.js';

export const db=database;
async function migrateLegacyDocuments() {
  const legacy=globalThis.__finnState?.documents;
  if(!legacy?.size)return;
  globalThis.__finnLegacyMigration ||= (async()=>{
    for(const document of legacy.values())await putRecord('documents',document.id,{...document,pages:new Set(document.chunks.map(c=>c.page)).size,chunkCount:document.chunks.length,hasOriginal:false,migratedFrom:'v0-memory'});
    legacy.clear();
  })().catch(error=>{globalThis.__finnLegacyMigration=null;throw error;});
  await globalThis.__finnLegacyMigration;
}
export async function getDocuments(ticker,demo=false) {
  if(demo)return sampleDocuments.filter(d=>d.ticker===ticker);
  await migrateLegacyDocuments();return queryRecords('documents',{query:{ticker},sort:{createdAt:-1},limit:100});
}
export async function saveDocument(document,original) {
  await migrateLegacyDocuments();
  const existing=await getRecord('documents',document.id);
  if(original)await saveOriginal(document.id,original);
  return putRecord('documents',document.id,{...document,createdAt:existing?.createdAt||document.createdAt,pages:new Set(document.chunks.map(c=>c.page)).size,chunkCount:document.chunks.length,hasOriginal:!!original||!!existing?.hasOriginal,updatedAt:new Date().toISOString()});
}
export function secretMatches(provided,secret) {
  return equalSecret(provided,secret);
}
export async function authorize(request) {
  const secret=process.env.FINN_ACCESS_KEY;
  if(!secret&&(process.env.VERCEL||process.env.NODE_ENV==='production'))return Response.json({error:'Configure FINN_ACCESS_KEY to enable this workspace.'},{status:503});
  if(request.method!=='GET'&&!sameOrigin(request))return Response.json({error:'Cross-origin workspace changes are not allowed.'},{status:403});
  try {
    if(secret&&!secretMatches(request.headers.get('x-finn-key'),secret)&&!await validSession(request))return Response.json({error:'Your workspace is locked. Sign in again.'},{status:401,headers:{'Cache-Control':'private, no-store'}});
    const window=Math.floor(Date.now()/60000),ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'local';
    const group=new URL(request.url).pathname.includes('research')?'research':request.method==='GET'?'read':'write';
    const id=createHash('sha256').update(`${ip}:${group}:${window}`).digest('hex');
    if(!await consumeQuota(id,group==='read'?120:group==='research'?20:30,(window+1)*60000))return Response.json({error:'Too many requests. Try again in a minute.',code:'RATE_LIMITED'},{status:429,headers:{'Retry-After':'60'}});
  }catch{return errorResponse(Object.assign(new Error('Workspace storage is unavailable. Check the database connection.'),{status:503}));}
  return null;
}
export function errorResponse(error,status=error?.status||400) {
  const requestId=randomUUID();
  console.error('[FINN]',JSON.stringify({requestId,code:error?.code||error?.name||'ERROR',status}));
  const storage=/mongo|server selection|authentication failed|ENOTFOUND|ECONNREFUSED/i.test(error?.message||'')||String(error?.name).startsWith('Mongo');
  const internal=['TypeError','ReferenceError','SyntaxError'].includes(error?.name)||/^(?:EACCES|EPERM|ENOENT|ECONN|ENOTFOUND|ERR_)/.test(String(error?.code||''));
  return Response.json({error:storage?'Data storage is unavailable. Check the MongoDB connection.':internal?'The request could not be completed. Please retry.':error?.message||'Something went wrong. Please retry.',code:internal?'REQUEST_FAILED':error?.code||'REQUEST_FAILED',requestId,retryAfter:error?.retryAfter||undefined},{status:storage?503:internal?500:status,headers:{'X-Request-Id':requestId,'Cache-Control':'no-store',...(error?.retryAfter?{'Retry-After':String(error.retryAfter)}:{})}});
}
