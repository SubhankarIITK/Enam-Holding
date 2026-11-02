import {authorize,errorResponse} from '@/lib/server';
import {getMarket} from '@/lib/market';
export const runtime='nodejs';
export const maxDuration=30;
export async function GET(request) {
  const denied=await authorize(request);if(denied)return denied;
  try{return Response.json(await getMarket(new URL(request.url).searchParams.get('ticker')),{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return errorResponse(error);}
}
