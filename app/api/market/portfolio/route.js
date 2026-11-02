import {readJson} from '@/lib/http';
import {authorize,errorResponse} from '@/lib/server';
import {savedPortfolio,refreshPortfolio} from '@/lib/portfolio-market';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function GET(request){
  const denied=await authorize(request);if(denied)return denied;
  try{return Response.json(await savedPortfolio((new URL(request.url).searchParams.get('tickers')||'').split(',').filter(Boolean)),{headers});}
  catch(error){return errorResponse(error);}
}
export async function POST(request){
  const denied=await authorize(request);if(denied)return denied;
  try{const body=await readJson(request,3000);return Response.json(await refreshPortfolio(body.tickers),{headers});}
  catch(error){return errorResponse(error);}
}
