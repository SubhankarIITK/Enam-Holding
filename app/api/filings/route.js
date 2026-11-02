import {readJson} from '@/lib/http';
import {authorize,errorResponse} from '@/lib/server';
import {normalizeTicker} from '@/lib/engine';
import {readFilings,syncFilings} from '@/lib/filings';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request) {
  const denied=await authorize(request);if(denied)return denied;
  try{
    const url=new URL(request.url),tickers=[...new Set((url.searchParams.get('tickers')||'').split(',').filter(Boolean).map(normalizeTicker))];
    const hours=Number(url.searchParams.get('hours')||24);
    if(!tickers.length||tickers.length>40||!Number.isFinite(hours)||hours<1||hours>168)throw new Error('Choose 1–40 tickers and a window between 1 and 168 hours.');
    return Response.json(await readFilings(tickers,hours),{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error);}
}
export async function POST(request) {
  const denied=await authorize(request);if(denied)return denied;
  try{const body=await readJson(request);if(!Array.isArray(body.tickers))throw new Error('Provide a list of NSE tickers.');return Response.json(await syncFilings(body.tickers,{saveWatchlist:body.persistWatchlist===true}));}
  catch(error){return errorResponse(error);}
}
