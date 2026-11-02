import {authorize,errorResponse} from '@/lib/server';
import {getQuote} from '@/lib/quotes';
export const runtime='nodejs';
export async function GET(request){const denied=await authorize(request);if(denied)return denied;try{return Response.json(await getQuote(new URL(request.url).searchParams.get('ticker')),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return errorResponse(error);}}
