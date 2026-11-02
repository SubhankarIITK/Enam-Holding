import {readJson} from '@/lib/http';
import {authorize,getDocuments,errorResponse} from '@/lib/server';
import {normalizeTicker,retrieve} from '@/lib/engine';
import {researchEvidence} from '@/lib/retrieval';
import {checkedResearchFacts} from '@/lib/research-facts';
import {cachedResearch,researchCacheKey} from '@/lib/research-cache';
import {analysisIdentifier,stageAnalysis} from '@/lib/saved-research';
export const runtime='nodejs';
export const maxDuration=60;
const sampleAnswer=`In this illustrative scenario, growth and profitability tell different stories. Revenue reached ₹42,800 crore, up 8.4% year on year, but EBITDA margin of 20.6% fell below the earlier 21–22% guidance range. That is a miss against the stated margin target. [1]\n\nCash generation is the stronger part of the sample: operating cash flow of ₹26,000 crore exceeds PAT of ₹24,600 crore, implying 105.7% cash conversion. Subtracting ₹3,200 crore of capex gives ₹22,800 crore in free cash flow. These are annual figures and should not be compared directly with quarterly profit. [2]\n\nWhat to watch: whether the promised second-half margin recovery appears in subsequent results. The available sample does not contain four quarters of matched guidance and outcomes, so it cannot establish a four-quarter track record. [1]\n\nAll company numbers and management statements here are invented demo fixtures.`;
export async function POST(request) {
  try {
    const body=await readJson(request);
    const ticker=normalizeTicker(body.ticker);
    const question=String(body.question||'').trim();
    if(question.length<5||question.length>1000) throw new Error('Ask a question between 5 and 1,000 characters.');
    if(body.demo) {
      if(ticker!=='INFY') return Response.json({error:'The illustrative research walkthrough is available for INFY. Turn off sample mode and add primary documents to research any other ticker.'},{status:422});
      const docs=await getDocuments(ticker,true);
      if(!process.env.GROQ_API_KEY) {
        const all=retrieve(docs,'guidance margin');
        const one=all.find(s=>s.documentId==='sample-call'&&s.page===1);
        const two=all.find(s=>s.documentId==='sample-ar'&&s.page===1);
        return Response.json({answer:sampleAnswer,citations:[1,2],sources:[{...one,citation:1},{...two,citation:2}],demo:true,mode:'walkthrough',notice:'Prewritten walkthrough, not a generated answer. Connect Groq for question-specific analysis.'});
      }
    }
    const denied=await authorize(request);if(denied) return denied;
    const docs=await getDocuments(ticker,!!body.demo);
    if(!docs.length) return Response.json({error:`No primary documents for ${ticker}. Add an annual report or earnings-call transcript first.`},{status:422});
    if(!process.env.GROQ_API_KEY) return Response.json({error:'Add GROQ_API_KEY to enable analysis of your uploaded documents. The sample walkthrough works without a key.'},{status:503});
    const sources=researchEvidence(docs,question);
    const retrieval={method:'BM25 keyword ranking',embeddings:false,documentCount:docs.length,indexedPassages:docs.reduce((n,d)=>n+d.chunks.length,0),retrievedPassages:sources.length,contextCharacters:sources.reduce((n,s)=>n+s.text.length,0)};
    if(!sources.length)return Response.json({answer:'The stored documents do not contain passages matching this question. Add a relevant primary document or ask a more specific question. No answer was generated from unrelated text.',citations:[],sources:[],demo:!!body.demo,mode:'no-matching-evidence',insufficientEvidence:true,retrieval,notice:'No relevant passages retrieved. Groq was not called.'});
    const options={ticker,question,sources,facts:checkedResearchFacts(docs,sources,question),apiKey:process.env.GROQ_API_KEY,model:process.env.GROQ_MODEL||'llama-3.3-70b-versatile'};
    const validated=await cachedResearch(options);
    const result={...validated,ticker,question,sources:sources.filter(s=>validated.citations.includes(s.citation)),retrieval,demo:!!body.demo,mode:'groq',notice:body.demo?'Generated from synthetic sample excerpts.':'Generated only from your stored primary-source excerpts. Verify material numbers against the original document.'};
    if(!body.demo){try{result.analysisId=await stageAnalysis(analysisIdentifier(researchCacheKey(options),validated.answer),result);}catch{result.saveNotice='Answer ready. Saving is temporarily unavailable; export it or retry later.';}}
    return Response.json(result);
  } catch(e) {if(e.name==='TimeoutError') return Response.json({error:'Research timed out. Please retry with a narrower question.'},{status:504});return errorResponse(e,e.status||400);}
}
