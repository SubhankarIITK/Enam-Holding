import {authorize,errorResponse} from '@/lib/server';
import {database,storageConfig,putRecord,getRecord} from '@/lib/repository';
export const runtime='nodejs';
export async function GET(request) {
  const denied=await authorize(request);if(denied)return denied;
  try {
    const config=storageConfig(),db=await database();
    if(db)await db.command({ping:1},{maxTimeMS:2000});
    else {await putRecord('workspace','health',{checkedAt:new Date().toISOString()});await getRecord('workspace','health');}
    return Response.json({version:'4.0.0',storage:config.mode,storageReady:true,groqConfigured:!!process.env.GROQ_API_KEY,cronConfigured:!!process.env.CRON_SECRET,warning:config.warning,checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return errorResponse(error,503);}
}
