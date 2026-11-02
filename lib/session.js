import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {getRecord,putRecord,deleteRecord} from './repository.js';
export const sessionCookie='finn_session';
const digest=value=>createHash('sha256').update(value).digest('hex');
export function equalSecret(a,b){if(typeof a!=='string'||typeof b!=='string'||!a||!b||a.length>1024)return false;const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);}
export function sessionToken(request){const cookie=request.headers.get('cookie')||'';return cookie.split(';').map(p=>p.trim()).find(p=>p.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1)||'';}
export async function validSession(request,now=Date.now()){
  const token=sessionToken(request),key=process.env.FINN_ACCESS_KEY;
  if(!key||!/^[a-f0-9]{64}$/.test(token))return false;
  const record=await getRecord('sessions',digest(token));
  return !!record&&new Date(record.expiresAt).getTime()>now&&equalSecret(record.keyHash,digest(key));
}
export async function createSession(){
  const token=randomBytes(32).toString('hex'),expiresAt=new Date(Date.now()+8*3600000);
  await putRecord('sessions',digest(token),{keyHash:digest(process.env.FINN_ACCESS_KEY),expiresAt});return token;
}
export async function revokeSession(request){const token=sessionToken(request);if(/^[a-f0-9]{64}$/.test(token))await deleteRecord('sessions',digest(token));}
export function cookieHeader(token,clear=false){return `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:8*3600}${process.env.NODE_ENV==='production'||process.env.VERCEL?'; Secure':''}`;}
