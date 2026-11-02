// Read-only release preflight. Report checks, never environment values.
import env from '@next/env';
import {MongoClient} from 'mongodb';
env.loadEnvConfig(process.cwd(),false);
const results=[],check=(name,ok)=>results.push({check:name,ok:!!ok});
const uri=process.env.MONGODB_URI||'',key=process.env.FINN_ACCESS_KEY||'',cron=process.env.CRON_SECRET||'';
let client;
check('Workspace key has at least 32 characters',key.length>=32&&!/your-|example|test-only/i.test(key));
check('Cron secret has at least 32 characters and differs from workspace key',cron.length>=32&&cron!==key);
check('Groq key and model configured',!!process.env.GROQ_API_KEY&&!!process.env.GROQ_MODEL);
try{const url=new URL(process.env.FINN_APP_URL);check('Canonical HTTPS app URL configured',url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/');}catch{check('Canonical HTTPS app URL configured',false);}
check('Production local-storage override disabled',process.env.FINN_ALLOW_LOCAL_STORAGE!=='true');
try{client=new MongoClient(uri,{serverSelectionTimeoutMS:6000,connectTimeoutMS:6000});check('Mongo URI parsed and TLS enabled',client.options.tls===true);await client.connect();await client.db(process.env.MONGODB_DB||'finn').command({ping:1},{maxTimeMS:3000});check('MongoDB responds to ping',true);}catch{check('MongoDB responds to ping',false);}finally{await client?.close();}
for(const result of results)console.log(`${result.ok?'PASS':'FAIL'} ${result.check}`);
process.exitCode=results.every(r=>r.ok)?0:1;
