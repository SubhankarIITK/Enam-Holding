import {readJson} from '@/lib/http';
import {authorize,errorResponse} from '@/lib/server';
import {getRecord,putRecord,storageConfig,withLease} from '@/lib/repository';
import {importPrimary} from '@/lib/import-primary';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request){
  const denied=await authorize(request);if(denied)return denied;
  try{
    const body=await readJson(request),period=String(body.period||'').trim().slice(0,40);let source;
    if(body.sourceId){
      if(!/^source-[a-f0-9]{32}$/.test(body.sourceId))throw new Error('Select a discovered primary source.');
      source=await getRecord('researchSources',body.sourceId);if(!source)throw new Error('Source listing has expired. Find sources again.');
    }else{
      if(!/^nse-[a-f0-9]{32}$/.test(body.filingId||'')||!period)throw new Error('Select a synced NSE document and specify its financial period.');
      const filing=await getRecord('filings',body.filingId);if(!filing?.url)throw new Error('The synced filing has no supported attachment.');
      const text=filing.title+' '+filing.sourceText,type=/\btranscripts?\b/i.test(text)?'transcript':/annual report/i.test(text)?'annual_report':null;
      if(!type)throw new Error('Only annual reports and earnings-call transcripts can be imported for research.');source={...filing,type};
    }
    const imported=await withLease(`import-${source.id}`,()=>importPrimary(source,{period:period||source.period}));
    if(body.sourceId)await putRecord('researchSources',source.id,{...source,importedDocumentId:imported.id});
    return Response.json({...imported,storage:storageConfig().mode});
  }catch(error){return errorResponse(error);}
}
