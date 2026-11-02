import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {analysisIdentifier,stageAnalysis,saveAnalysis,listAnalyses,readAnalysis,removeAnalysis} from '../lib/saved-research.js';
import {putRecord,deleteRecord} from '../lib/repository.js';
import {researchMarkdown} from '../lib/research-export.js';
const root=await mkdtemp(path.join(tmpdir(),'finn-saved-test-'));process.env.FINN_DATA_DIR=root;process.env.MONGODB_URI='';delete process.env.VERCEL;
after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.ok(path.basename(root).startsWith('finn-saved-test-'));await rm(root,{recursive:true,force:true});});
const id='analysis-'+'a'.repeat(64),source={documentId:'document',citation:1,title:'Test report',period:'FY26',page:3,text:'Synthetic test evidence.',url:'https://nsearchives.nseindia.com/test.pdf'};
const answer={ticker:'TEST',question:'What changed?',mode:'groq',demo:false,answer:'A test answer [1].',sources:[source],generatedAt:'2026-10-29T00:00:00Z'};
test('analyses save from server snapshots, reopen, deduplicate and delete without removing source documents',async()=>{
  await putRecord('documents','document',{ticker:'TEST'});await stageAnalysis(id,answer);await saveAnalysis(id);
  assert.equal((await readAnalysis(id)).analysisId,id);assert.equal((await listAnalyses('TEST')).length,1);await saveAnalysis(id);assert.equal((await listAnalyses('TEST')).length,1);
  await removeAnalysis(id);await assert.rejects(()=>readAnalysis(id),e=>e.status===404);assert.equal((await listAnalyses('TEST')).length,0);
});
test('expired answers, removed evidence, samples and malformed IDs cannot be saved',async()=>{
  await assert.rejects(()=>saveAnalysis('invalid'),/valid analysis/);
  await assert.rejects(()=>saveAnalysis('analysis-'+'b'.repeat(64)),e=>e.status===410);
  await stageAnalysis(id,{...answer,demo:true});await assert.rejects(()=>saveAnalysis(id),/primary-source/);
  await stageAnalysis(id,answer);await deleteRecord('documents','document');await assert.rejects(()=>saveAnalysis(id),e=>e.status===409);
});
test('Markdown export includes the answer, exact evidence, page, source link and generation time',()=>{
  const markdown=researchMarkdown(answer);for(const part of [answer.question,answer.answer,source.text,'page 3',source.url,answer.generatedAt])assert.ok(markdown.includes(part));
});

test('a regenerated answer gets a new saved identity when its content changes',()=>{
  assert.equal(analysisIdentifier('research-key','same answer'),analysisIdentifier('research-key','same answer'));
  assert.notEqual(analysisIdentifier('research-key','old answer'),analysisIdentifier('research-key','new answer'));
});
