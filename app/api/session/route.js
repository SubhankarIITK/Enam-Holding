import {createHash} from 'node:crypto';
import {equalSecret,validSession,createSession,revokeSession,cookieHeader} from '@/lib/session';
import {consumeQuota} from '@/lib/repository';
import {readJson,sameOrigin} from '@/lib/http';
import {errorResponse} from '@/lib/server';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request){
  try{const required=!!process.env.FINN_ACCESS_KEY;if(!required&&(process.env.NODE_ENV==='production'||process.env.VERCEL))return Response.json({error:'Workspace access is not configured.'},{status:503,headers});return Response.json({required,authenticated:!required||await validSession(request)},{headers});}
  catch(error){return errorResponse(error,503);}
}
export async function POST(request){
  if(!sameOrigin(request))return Response.json({error:'Cross-origin sign-in is not allowed.'},{status:403,headers});
  if(!process.env.FINN_ACCESS_KEY)return Response.json({error:'Workspace access is not configured.'},{status:503,headers});
  try{
    const minute=Math.floor(Date.now()/60000),ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'local',end=(minute+1)*60000;
    const id=createHash('sha256').update(`login:${ip}:${minute}`).digest('hex');
    if(!await consumeQuota(id,10,end)||!await consumeQuota(`login-global-${minute}`,60,end))return Response.json({error:'Too many sign-in attempts. Try again in a minute.'},{status:429,headers:{...headers,'Retry-After':'60'}});
    const body=await readJson(request,2048);
    if(!equalSecret(body.key,process.env.FINN_ACCESS_KEY))return Response.json({error:'The workspace key is incorrect.'},{status:401,headers});
    await revokeSession(request);const token=await createSession();return Response.json({authenticated:true},{headers:{...headers,'Set-Cookie':cookieHeader(token)}});
  }catch(error){return errorResponse(error);}
}
export async function DELETE(request){
  if(!sameOrigin(request))return Response.json({error:'Cross-origin sign-out is not allowed.'},{status:403,headers});
  try{await revokeSession(request);return Response.json({authenticated:false},{headers:{...headers,'Set-Cookie':cookieHeader('',true)}});}catch(error){return errorResponse(error,503);}
}
