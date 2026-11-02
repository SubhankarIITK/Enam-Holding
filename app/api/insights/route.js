import {authorize,errorResponse} from '@/lib/server';
import {readJson} from '@/lib/http';
import {normalizeTicker} from '@/lib/engine';
import {getRecord} from '@/lib/repository';
import {companyInsights,extractCompanyDocument,filingInsights} from '@/lib/company-insights';
import {researchDemoStatus} from '@/lib/demo-research';
export const runtime='nodejs';
export const maxDuration=120;
export async function GET(request){const denied=await authorize(request);if(denied)return denied;try{const url=new URL(request.url);if(url.searchParams.get('demos')==='true')return Response.json({companies:await researchDemoStatus()},{headers:{'Cache-Control':'private, no-store'}});if(url.searchParams.has('filingId')){const filing=await getRecord('filings',url.searchParams.get('filingId'));if(!filing)throw new Error('Filing not found.');return Response.json({insights:await filingInsights(filing)},{headers:{'Cache-Control':'private, no-store'}});}return Response.json(await companyInsights(normalizeTicker(url.searchParams.get('ticker'))),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return errorResponse(e);}}
export async function POST(request){const denied=await authorize(request);if(denied)return denied;try{const body=await readJson(request,2000);if(body.filingId){const filing=await getRecord('filings',body.filingId);if(!filing)throw new Error('Filing not found.');return Response.json({insights:await filingInsights(filing,{generate:true})},{headers:{'Cache-Control':'private, no-store'}});}const ticker=normalizeTicker(body.ticker);if(!/^[a-f0-9]{24}$/.test(body.documentId||''))throw new Error('Select a primary document.');return Response.json(await extractCompanyDocument(ticker,body.documentId),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return errorResponse(e,e.status||400);}}
