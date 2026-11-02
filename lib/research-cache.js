import {createHash} from 'node:crypto';
import {getCached,setCached,singleFlight} from './repository.js';
import {generateResearch} from './research-service.js';

export function researchCacheKey({ticker,question,model,sources,facts=[]}) {
  return 'research-'+createHash('sha256').update(JSON.stringify({version:'v4-financial-evidence-2',ticker,question:question.trim().toLowerCase().replace(/\s+/g,' '),model,facts,sources:sources.map(({id,text,page})=>({id,text,page}))})).digest('hex');
}
export async function cachedResearch(options) {
  const key=researchCacheKey(options),cached=await getCached(key);
  if(cached)return {...cached.value,cached:true,generatedAt:cached.storedAt};
  return singleFlight(key,async()=>{
    const result=await generateResearch(options);await setCached(key,result,6*3600000);
    return {...result,cached:false,generatedAt:new Date().toISOString()};
  });
}
