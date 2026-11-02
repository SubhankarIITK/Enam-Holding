import {authorize,errorResponse} from '@/lib/server';
import {discoverSources} from '@/lib/source-discovery';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request){
  const denied=await authorize(request);if(denied)return denied;
  try{return Response.json(await discoverSources(new URL(request.url).searchParams.get('ticker')),{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return errorResponse(error);}
}
