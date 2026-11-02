import {readJson} from '@/lib/http';
import {authorize,errorResponse} from '@/lib/server';
import {normalizeTicker} from '@/lib/engine';
import {getRecord,putRecord,queryRecords,deleteRecord} from '@/lib/repository';
import {validateFinancialMetric} from '@/lib/financial-metrics';
export const runtime='nodejs';
export async function GET(request){
  const denied=await authorize(request);if(denied)return denied;
  try{const ticker=normalizeTicker(new URL(request.url).searchParams.get('ticker'));const rows=await queryRecords('metrics',{query:{ticker},sort:{periodEnd:1},limit:1001});return Response.json({figures:rows.slice(0,1000),truncated:rows.length>1000},{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return errorResponse(error);}
}
export async function POST(request){
  const denied=await authorize(request);if(denied)return denied;
  try{const input=await readJson(request);if(!input||typeof input.documentId!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(input.documentId))throw new Error('Select a stored primary document.');const document=await getRecord('documents',input.documentId);const record=validateFinancialMetric(input,document);await putRecord('metrics',record.id,record);return Response.json({figure:record},{status:201});}
  catch(error){return errorResponse(error);}
}
export async function DELETE(request){
  const denied=await authorize(request);if(denied)return denied;
  try{const id=new URL(request.url).searchParams.get('id');if(!/^[a-f0-9]{32}$/.test(id||''))throw new Error('Select a valid saved figure.');await deleteRecord('metrics',id);return Response.json({deleted:true});}
  catch(error){return errorResponse(error);}
}
