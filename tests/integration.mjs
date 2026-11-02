// Isolated production API check. No real keys, external API calls or user data writes.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {once} from 'node:events';
import path from 'node:path';

const root=await mkdtemp(path.join(tmpdir(),'finn-v1-api-'));
const reservation=createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
const base=`http://127.0.0.1:${port}`,headers={'x-finn-key':'integration-test-only',Origin:base};
let child,log='';
async function start(){
  child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'production',MONGODB_URI:'',GROQ_API_KEY:'',FINN_ACCESS_KEY:'integration-test-only',CRON_SECRET:'integration-cron-only',VERCEL:'',FINN_DATA_DIR:root,FINN_ALLOW_LOCAL_STORAGE:'true'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  child.stdout.on('data',data=>log+=data);child.stderr.on('data',data=>log+=data);
  for(let i=0;i<100;i++){try{const r=await fetch(base+'/api/status');if(r.ok)return;}catch{}if(child.exitCode!==null)throw new Error('Test server failed: '+log);await new Promise(resolve=>setTimeout(resolve,200));}
  throw new Error('Timed out waiting for isolated server.');
}
async function stop(){if(child&&child.exitCode===null){child.kill();await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,4000))]);}}
try {
  await start();
  assert.equal((await fetch(base)).status,200);
  const status=await(await fetch(base+'/api/status')).json();assert.equal(status.version,'4.0.0');assert.equal(status.storage,'local-disk');
  assert.equal((await fetch(base+'/api/health')).status,401);
  assert.equal((await fetch(base+'/api/health',{headers})).status,200);
  assert.equal((await fetch(base+'/api/cron/sync')).status,401);
  const sessionState=await(await fetch(base+'/api/session')).json();assert.equal(sessionState.authenticated,false);
  const signIn=await fetch(base+'/api/session',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({key:'integration-test-only'})});assert.equal(signIn.status,200);
  const setCookie=signIn.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);assert.match(setCookie,/Secure/);const cookie=setCookie.split(';')[0];
  assert.equal((await fetch(base+'/api/health',{headers:{cookie}})).status,200);
  assert.equal((await fetch(base+'/api/session',{method:'POST',headers:{Origin:'https://foreign.example','Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/filings',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{bad-secret-value'})).status,400);
  const foreignCookie=await fetch(base+'/api/filings',{method:'POST',headers:{cookie,Origin:'https://foreign.example','Content-Type':'application/json'},body:'{}'});assert.equal(foreignCookie.status,403);
  const signOut=await fetch(base+'/api/session',{method:'DELETE',headers:{cookie,Origin:base}});assert.equal(signOut.status,200);assert.match(signOut.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await fetch(base+'/api/health',{headers:{cookie}})).status,401);
  const pageHeaders=(await fetch(base)).headers;assert.ok(pageHeaders.get('content-security-policy'));assert.equal(pageHeaders.get('x-frame-options'),'DENY');
  assert.equal((await fetch(base+'/api/updates?tickers=INFY')).status,401);
  const updateSnapshot=await fetch(base+'/api/updates?tickers=INFY',{headers});assert.equal(updateSnapshot.status,200);assert.deepEqual((await updateSnapshot.json()).quotes,{});
  assert.equal((await fetch(base+'/api/updates',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{bad'})).status,400);
  const cleared=await fetch(base+'/api/updates',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({tickers:[]})});assert.equal(cleared.status,200);assert.deepEqual((await cleared.json()).prices,{});
  const empty=await fetch(base+'/api/filings?tickers=INFY&hours=24',{headers});assert.equal(empty.status,200);assert.deepEqual((await empty.json()).announcements,[]);
  assert.equal((await fetch(base+'/api/filings?tickers=../bad',{headers})).status,400);
  const foreign=await fetch(base+'/api/documents',{method:'POST',headers:{...headers,Origin:'https://untrusted.example'}});assert.equal(foreign.status,403);
  const sample=await fetch(base+'/api/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker:'INFY',question:'What changed?',demo:true})});assert.equal(sample.status,200);assert.equal((await sample.json()).mode,'walkthrough');
  assert.equal((await fetch(base+'/api/research/sources?ticker=TESTLAB')).status,401);
  assert.equal((await fetch(base+'/api/research/sources?ticker=../bad',{headers})).status,400);
  assert.equal((await fetch(base+'/api/documents/import',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({sourceId:'source-'+'a'.repeat(32)})})).status,400);
  const form=new FormData();form.set('ticker','TESTLAB');form.set('title','Isolated test excerpt');form.set('period','FY26');form.set('type','annual_report');form.set('text','Synthetic isolated test data. Revenue was 100 crore. Operating cash flow was 15 crore. Profit after tax was 12 crore. These are invented values and make no real company claim.');
  const upload=await fetch(base+'/api/documents',{method:'POST',headers,body:form});const document=await upload.json();assert.equal(upload.status,200,JSON.stringify(document));assert.equal(document.storage,'local-disk');
  const repeated=await(await fetch(base+'/api/documents',{method:'POST',headers,body:form})).json();assert.equal(repeated.id,document.id);
  const docs=await(await fetch(base+'/api/documents?ticker=TESTLAB',{headers})).json();assert.equal(docs.documents.length,1);
  assert.equal((await fetch(base+`/api/documents/${document.id}/original`,{headers})).status,404);
  const analysisId='analysis-'+'a'.repeat(64),analysis={ticker:'TESTLAB',question:'Synthetic test question',answer:'Synthetic test answer [1].',mode:'groq',demo:false,generatedAt:new Date().toISOString(),analysisId,sources:[{documentId:document.id,citation:1,title:'Test report',period:'FY26',page:1,text:'Revenue was 100 crore.'}]};
  await mkdir(path.join(root,'cache'),{recursive:true});await writeFile(path.join(root,'cache',analysisId+'.json'),JSON.stringify({id:analysisId,value:analysis,storedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()}));
  const savedAnswer=await fetch(base+'/api/research/saved',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({analysisId})});assert.equal(savedAnswer.status,201);
  assert.equal((await(await fetch(base+'/api/research/saved?ticker=TESTLAB',{headers})).json()).analyses.length,1);
  assert.equal((await(await fetch(base+`/api/research/saved?id=${analysisId}`,{headers})).json()).analysis.answer,analysis.answer);
  assert.equal((await fetch(base+`/api/research/saved?id=${analysisId}`)).status,401);
  assert.equal((await fetch(base+`/api/research/saved?id=${analysisId}`,{method:'DELETE',headers})).status,200);
  assert.equal((await fetch(base+'/api/research/saved',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({analysisId})})).status,201);

  assert.equal((await fetch(base+'/api/documents/import',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({filingId:'http://localhost/private',period:'FY26'})})).status,400);
  const page=await fetch(base+`/api/documents/${document.id}/page?page=1`,{headers});assert.equal(page.status,200);assert.ok((await page.json()).passages.length);
  const figure={documentId:document.id,page:1,metric:'Revenue',value:100,unit:'INR crore',periodType:'Year',periodEnd:'2026-03-31',periodLabel:'FY26',quote:'Revenue was 100 crore. Operating cash flow was 15 crore.'};
  const saveFigure=await fetch(base+'/api/financials',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(figure)});assert.equal(saveFigure.status,201,JSON.stringify(await saveFigure.json()));
  const badFigure=await fetch(base+'/api/financials',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({...figure,value:999})});assert.equal(badFigure.status,400);
  const figures=await(await fetch(base+'/api/financials?ticker=TESTLAB',{headers})).json();assert.equal(figures.figures.length,1);assert.equal(figures.figures[0].value,100);
  assert.equal((await fetch(base+'/api/insights?ticker=TESTLAB')).status,401);
  assert.equal((await fetch(base+'/api/insights?ticker=../bad',{headers})).status,400);
  const insightViews=await(await fetch(base+'/api/insights?ticker=TESTLAB',{headers})).json();assert.equal(insightViews.ticker,'TESTLAB');assert.equal(insightViews.documents.length,1);assert.equal(insightViews.figures.length,0);
  const demos=await(await fetch(base+'/api/insights?demos=true',{headers})).json();assert.equal(demos.companies.length,3);assert.ok(demos.companies.every(c=>c.ready===false));
  assert.equal((await fetch(base+'/api/insights',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({ticker:'TESTLAB',documentId:'not-valid'})})).status,400);
  assert.equal((await fetch(base+'/api/financials?ticker=TESTLAB')).status,401);
  const snapshot=await(await fetch(base+'/api/market/portfolio?tickers=TESTLAB',{headers})).json();assert.deepEqual(snapshot.prices,{});assert.deepEqual(snapshot.missing,['TESTLAB']);
  assert.equal((await fetch(base+'/api/market/portfolio',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({tickers:[]})})).status,400);
  if(process.argv[2]){
    const original=await readFile(process.argv[2]),pdfForm=new FormData();pdfForm.set('ticker','PDFTEST');pdfForm.set('title','Local PDF parser test');pdfForm.set('period','TEST');pdfForm.set('type','annual_report');pdfForm.set('file',new Blob([original],{type:'application/pdf'}),'test.pdf');
    const response=await fetch(base+'/api/documents',{method:'POST',headers,body:pdfForm});const parsed=await response.json();assert.equal(response.status,200,JSON.stringify(parsed));assert.ok(parsed.hasOriginal&&parsed.pages>0);
    const download=await fetch(base+`/api/documents/${parsed.id}/original`,{headers});assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),original);
    console.log('Actual PDF extraction and authenticated original download passed.');
  }
  await stop();await start();
  assert.equal((await(await fetch(base+'/api/research/saved?ticker=TESTLAB',{headers})).json()).analyses.length,1);
  const afterRestart=await(await fetch(base+'/api/documents?ticker=TESTLAB',{headers})).json();assert.equal(afterRestart.documents.length,1);assert.equal(afterRestart.documents[0].id,document.id);
  assert.equal((await(await fetch(base+'/api/financials?ticker=TESTLAB',{headers})).json()).figures.length,1);
  const storedFigures=(await(await fetch(base+'/api/financials?ticker=TESTLAB',{headers})).json()).figures;
  const removed=await fetch(base+`/api/financials?id=${storedFigures[0].id}`,{method:'DELETE',headers});assert.equal(removed.status,200);
  assert.equal((await(await fetch(base+'/api/financials?ticker=TESTLAB',{headers})).json()).figures.length,0);
  assert.equal((await(await fetch(base+'/api/documents?ticker=TESTLAB',{headers})).json()).documents.length,1);
  await mkdir(path.join(root,'cache'),{recursive:true});await writeFile(path.join(root,'cache','insight-integration.json'),JSON.stringify({id:'insight-integration',documentId:document.id,value:{figures:[]},storedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()}));
  const deleteDocument=await fetch(base+`/api/documents/${document.id}`,{method:'DELETE',headers});assert.equal(deleteDocument.status,200);await assert.rejects(()=>readFile(path.join(root,'cache','insight-integration.json')),e=>e.code==='ENOENT');
  assert.equal((await(await fetch(base+'/api/documents?ticker=TESTLAB',{headers})).json()).documents.length,0);
  assert.equal((await(await fetch(base+'/api/research/saved?ticker=TESTLAB',{headers})).json()).analyses.length,0);
  console.log('Production API checks passed: saved analyses and source removal, session lifecycle, bounded bodies, security headers, v2 financial provenance and persistence, portfolio snapshots, access/origin protection, health, sample research, filings validation, idempotent upload, import validation and persistence across server restarts.');
}finally{
  await stop();assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.ok(path.basename(root).startsWith('finn-v1-api-'));await rm(root,{recursive:true,force:true});
}
