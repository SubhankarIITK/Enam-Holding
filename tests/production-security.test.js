import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readJson,boundedBytes,sameOrigin} from '../lib/http.js';
import {createSession,validSession,revokeSession,cookieHeader} from '../lib/session.js';
import {storageConfig,withLease} from '../lib/repository.js';
import {authorize} from '../lib/backend.js';

const root=await mkdtemp(path.join(tmpdir(),'finn-release-test-'));
process.env.FINN_DATA_DIR=root;process.env.MONGODB_URI='';process.env.FINN_ACCESS_KEY='isolated-release-test-key';delete process.env.VERCEL;delete process.env.FINN_APP_URL;
after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.ok(path.basename(root).startsWith('finn-release-test-'));await rm(root,{recursive:true,force:true});});
test('sessions are expiring, revocable and invalidated by key rotation',async()=>{
  const token=await createSession(),request=new Request('http://localhost/api/health',{headers:{cookie:`finn_session=${token}`}});
  assert.equal(await validSession(request),true);assert.equal(await validSession(request,Date.now()+9*3600000),false);
  assert.equal(await authorize(request),null);
  process.env.FINN_ACCESS_KEY='rotated-key';assert.equal(await validSession(request),false);process.env.FINN_ACCESS_KEY='isolated-release-test-key';
  await revokeSession(request);assert.equal(await validSession(request),false);
  assert.equal(await validSession(new Request('http://localhost',{headers:{cookie:'finn_session=invalid'}})),false);
  assert.match(cookieHeader(token),/HttpOnly; SameSite=Strict/);assert.match(cookieHeader('',true),/Max-Age=0/);
});
test('production storage fails closed unless durable local mode is explicitly enabled',()=>{
  const before=process.env.NODE_ENV;process.env.NODE_ENV='production';
  assert.equal(storageConfig().mode,'unconfigured');assert.match(cookieHeader('test'),/Secure/);
  process.env.FINN_ALLOW_LOCAL_STORAGE='true';assert.equal(storageConfig().mode,'local-disk');process.env.VERCEL='1';assert.equal(storageConfig().mode,'unconfigured');
  delete process.env.VERCEL;delete process.env.FINN_ALLOW_LOCAL_STORAGE;if(before===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=before;
});
test('bounded JSON rejects oversized streams, wrong media types and malformed secret-bearing bodies',async()=>{
  const request=body=>new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body});
  assert.deepEqual(await readJson(request('{"ok":true}')),{ok:true});
  await assert.rejects(()=>readJson(request('{"key":"private-value"')),e=>e.status===400&&!e.message.includes('private-value'));
  await assert.rejects(()=>readJson(request('null')),/JSON object/);
  await assert.rejects(()=>readJson(new Request('http://localhost',{method:'POST',body:'{}'})),e=>e.status===415);
  await assert.rejects(()=>boundedBytes(new Response('more-than-ten-bytes'),10),e=>e.status===413);
  await assert.rejects(()=>readJson(request('{"long":"123456789"}'),10),e=>e.status===413);
});
test('canonical origin blocks foreign browser changes',()=>{
  process.env.FINN_APP_URL='https://finn.example';
  assert.equal(sameOrigin(new Request('http://internal',{headers:{Origin:'https://finn.example'}})),true);
  assert.equal(sameOrigin(new Request('http://internal',{headers:{Origin:'https://foreign.example'}})),false);delete process.env.FINN_APP_URL;
});
test('sync lease rejects overlap and is released even after a failed run',async()=>{
  let release,entered;const started=new Promise(resolve=>entered=resolve);
  const first=withLease('exclusive',()=>new Promise(resolve=>{release=resolve;entered();}));await started;
  await assert.rejects(()=>withLease('exclusive',async()=>{}),e=>e.code==='SYNC_RUNNING');release();await first;
  await assert.rejects(()=>withLease('exclusive',async()=>{throw new Error('fixture failure');}),/fixture failure/);
  assert.equal(await withLease('exclusive',async()=>42),42);
});
