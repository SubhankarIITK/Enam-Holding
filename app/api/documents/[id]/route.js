import {authorize,errorResponse} from '@/lib/server';
import {getRecord,queryRecords,deleteRecord,deleteOriginal} from '@/lib/repository';
export const runtime='nodejs';
export async function DELETE(request,{params}){
  const denied=await authorize(request);if(denied)return denied;
  try{
    const {id}=await params;if(!/^[a-f0-9]{24}$/.test(id))throw new Error('Select a valid document.');
    const document=await getRecord('documents',id);if(!document)return Response.json({deleted:true});
    const figures=await queryRecords('metrics',{query:{documentId:id},limit:1001});
    if(figures.length>1000)throw new Error('This document has too many linked figures to remove in one request.');
    const analyses=await queryRecords('analyses',{query:{ticker:document.ticker},limit:1001});
    if(analyses.length>1000)throw new Error('Too many saved analyses are linked to this company for one removal request.');
    const insights=await queryRecords('cache',{query:{documentId:id},limit:1001});
    if(insights.length>1000)throw new Error('Too many generated views are linked to this document for one removal request.');
    await deleteOriginal(id);
    for(const figure of figures)await deleteRecord('metrics',figure.id);
    for(const analysis of analyses)if(analysis.documentIds?.includes(id))await deleteRecord('analyses',analysis.id);
    for(const insight of insights)await deleteRecord('cache',insight.id);
    await deleteRecord('documents',id);
    return Response.json({deleted:true,removedFigures:figures.length});
  }catch(error){return errorResponse(error);}
}
