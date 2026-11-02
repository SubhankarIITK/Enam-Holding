import {secretMatches,errorResponse} from '@/lib/server';
import {getRecord} from '@/lib/repository';
import {refreshWorkspace} from '@/lib/automatic-updates';
import {companies} from '@/lib/data';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request) {
  if(!process.env.CRON_SECRET)return Response.json({error:'Scheduled sync is not configured.'},{status:503});
  if(!secretMatches(request.headers.get('authorization'),`Bearer ${process.env.CRON_SECRET}`))return Response.json({error:'Unauthorized scheduled request.'},{status:401});
  try{
    const saved=await getRecord('workspace','watchlist');
    const tickers=saved?.tickers||process.env.FINN_SYNC_TICKERS?.split(',').filter(Boolean)||companies.map(c=>c.ticker);
    return Response.json(await refreshWorkspace(tickers),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return errorResponse(error);}
}
