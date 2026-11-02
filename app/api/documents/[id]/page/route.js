import {authorize,errorResponse} from '@/lib/server';
import {getRecord} from '@/lib/repository';
export const runtime='nodejs';
export async function GET(request,{params}){
  const denied=await authorize(request);if(denied)return denied;
  try{const {id}=await params,document=await getRecord('documents',id);if(!document)return Response.json({error:'Document not found.'},{status:404});const page=Number(new URL(request.url).searchParams.get('page'));const passages=document.chunks.filter(c=>c.page===page);if(!passages.length)return Response.json({error:'No extracted text on this page.'},{status:404});return Response.json({passages,page,title:document.title},{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return errorResponse(error);}
}
