import {authorize,errorResponse} from '@/lib/server';
import {readJson} from '@/lib/http';
import {refreshWorkspace,updateSnapshot} from '@/lib/automatic-updates';
import {portfolioTickers} from '@/lib/portfolio-market';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request){
  const denied=await authorize(request);if(denied)return denied;
  try{const input=new URL(request.url).searchParams.get('tickers')||'',tickers=input?portfolioTickers(input.split(',')):[];return Response.json(await updateSnapshot(tickers),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return errorResponse(error);}
}
export async function POST(request){
  const denied=await authorize(request);if(denied)return denied;
  try{const body=await readJson(request,3000),tickers=Array.isArray(body.tickers)&&!body.tickers.length?[]:portfolioTickers(body.tickers);let busy=false;try{await refreshWorkspace(tickers);}catch(error){if(error.code==='SYNC_RUNNING')busy=true;else throw error;}return Response.json({...await updateSnapshot(tickers),busy},{status:busy?202:200,headers:{'Cache-Control':'private, no-store'}});}catch(error){return errorResponse(error);}
}
