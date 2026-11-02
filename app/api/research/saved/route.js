import {authorize,errorResponse} from '@/lib/server';
import {normalizeTicker} from '@/lib/engine';
import {readJson} from '@/lib/http';
import {saveAnalysis,listAnalyses,readAnalysis,removeAnalysis} from '@/lib/saved-research';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request){
  const denied=await authorize(request);if(denied)return denied;
  try{const url=new URL(request.url),id=url.searchParams.get('id');return Response.json(id?{analysis:await readAnalysis(id)}:{analyses:await listAnalyses(normalizeTicker(url.searchParams.get('ticker')))},{headers});}catch(error){return errorResponse(error);}
}
export async function POST(request){
  const denied=await authorize(request);if(denied)return denied;
  try{const {analysisId}=await readJson(request,1000);const result=await saveAnalysis(analysisId);return Response.json({id:result.id,savedAt:result.savedAt},{headers,status:201});}catch(error){return errorResponse(error);}
}
export async function DELETE(request){
  const denied=await authorize(request);if(denied)return denied;
  try{await removeAnalysis(new URL(request.url).searchParams.get('id'));return Response.json({deleted:true},{headers});}catch(error){return errorResponse(error);}
}
