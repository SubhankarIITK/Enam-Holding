import {getCached,setCached,getRecord,putRecord,queryRecords,deleteRecord} from './repository.js';
const day=86400000;
export function analysisIdentifier(cacheKey,answerText=''){return 'analysis-'+createHash('sha256').update(JSON.stringify([cacheKey,answerText])).digest('hex');}
function identifier(id){if(typeof id!=='string'||!/^analysis-[a-f0-9]{64}$/.test(id))throw new Error('Select a valid analysis.');return id;}
export async function stageAnalysis(id,answer){identifier(id);await setCached(id,{...answer,analysisId:id},day);return id;}
export async function saveAnalysis(id){
  identifier(id);const snapshot=await getCached(id);if(!snapshot)throw Object.assign(new Error('This answer is no longer available to save. Ask the question again.'),{status:410});
  if(snapshot.value.demo||snapshot.value.mode!=='groq')throw new Error('Only primary-source research can be saved.');
  const documentIds=[...new Set(snapshot.value.sources.map(s=>s.documentId))];
  for(const documentId of documentIds)if(!await getRecord('documents',documentId))throw Object.assign(new Error('A source document was removed. Run fresh research before saving.'),{status:409});
  const savedAt=new Date().toISOString();
  return putRecord('analyses',id,{...snapshot.value,documentIds,savedAt,expiresAt:new Date(Date.now()+30*day)});
}
export async function listAnalyses(ticker){
  const rows=await queryRecords('analyses',{query:{ticker,savedAt:{$gte:new Date(Date.now()-30*day).toISOString()}},sort:{savedAt:-1},limit:20});
  return rows.map(({id,question,savedAt,generatedAt,sources})=>({id,question,savedAt,generatedAt,sourceCount:sources.length}));
}
export async function readAnalysis(id){const record=await getRecord('analyses',identifier(id));if(!record||new Date(record.expiresAt).getTime()<=Date.now())throw Object.assign(new Error('Saved analysis not found or expired.'),{status:404});return record;}
export async function removeAnalysis(id){await deleteRecord('analyses',identifier(id));}
import {createHash} from 'node:crypto';
