export const dynamic='force-dynamic';
export async function GET() {
  const config=storageConfig();
  return Response.json({groq:!!process.env.GROQ_API_KEY,storage:config.mode,storageWarning:config.warning,protected:!!process.env.FINN_ACCESS_KEY,version:'4.0.0',cron:!!process.env.CRON_SECRET},{headers:{'Cache-Control':'no-store'}});
}
import {storageConfig} from '@/lib/repository';
