import {MongoClient,Binary} from 'mongodb';
import {mkdir,readFile,writeFile,rename,readdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const collections=new Set(['documents','originals','filings','cache','sync','workspace','rates','metrics','sessions','leases','researchSources','analyses']);
const state=globalThis.__finnRepository ||= {client:null,clientUri:null,indexes:new Map()};
const storageError=()=>Object.assign(new Error('Data storage is unavailable. Check your database connection or local data directory.'),{status:503,code:'STORAGE_UNAVAILABLE'});

export function storageConfig() {
  const uri=process.env.MONGODB_URI?.trim();
  let valid=false;
  if(uri){try{new MongoClient(uri);valid=true;}catch{}}
  const requireMongo=process.env.VERCEL||(process.env.NODE_ENV==='production'&&process.env.FINN_ALLOW_LOCAL_STORAGE!=='true');
  return {mode:valid?'mongodb':requireMongo?'unconfigured':'local-disk',mongoConfigured:!!uri,mongoValid:valid,warning:uri&&!valid?'The MongoDB connection string is invalid. '+(requireMongo?'Configure a valid URI to enable storage.':'Development data is being saved locally.') :null};
}
export async function database() {
  const config=storageConfig();
  if(config.mode==='unconfigured') throw storageError();
  if(config.mode!=='mongodb')return null;
  const uri=process.env.MONGODB_URI.trim();
  if(state.clientUri!==uri){state.client=null;state.clientUri=uri;state.indexes.clear();}
  state.client ||= new MongoClient(uri,{serverSelectionTimeoutMS:5000,connectTimeoutMS:5000,maxPoolSize:8}).connect().catch(()=>{state.client=null;throw storageError();});
  try{return (await state.client).db(process.env.MONGODB_DB||'finn');}catch{throw storageError();}
}
async function collection(name) {
  if(!collections.has(name))throw new Error('Unknown data collection.');
  const db=await database();if(!db)return null;
  if(!state.indexes.has(name))state.indexes.set(name,(async()=>{
    await db.collection(name).createIndex({id:1},{unique:true});
    if(name==='documents')await db.collection(name).createIndex({ticker:1,createdAt:-1});
    if(name==='filings')await db.collection(name).createIndex({ticker:1,publishedAt:-1});
    if(name==='metrics')await db.collection(name).createIndex({ticker:1,periodEnd:1});
    if(name==='analyses'){await db.collection(name).createIndex({ticker:1,savedAt:-1});await db.collection(name).createIndex({documentIds:1});}
    if(['cache','rates','sessions','leases','analyses'].includes(name))await db.collection(name).createIndex({expiresAt:1},{expireAfterSeconds:0});
  })().catch(()=>{state.indexes.delete(name);throw storageError();}));
  await state.indexes.get(name);return db.collection(name);
}
function identifier(id){if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(id))throw new Error('Invalid record identifier.');return id;}
function localPath(name,id,extension='json') {
  if(!collections.has(name))throw new Error('Unknown data collection.');
  return path.join(/*turbopackIgnore: true*/process.env.FINN_DATA_DIR||path.join(process.cwd(),'.finn-data'),name,`${identifier(id)}.${extension}`);
}
async function atomicWrite(file,contents) {
  await mkdir(path.dirname(file),{recursive:true});
  const temporary=`${file}.${randomUUID()}.tmp`;
  try{await writeFile(temporary,contents,{mode:0o600});await rename(temporary,file);}
  catch{await unlink(temporary).catch(()=>{});throw storageError();}
}
export async function getRecord(name,id) {
  identifier(id);const records=await collection(name);
  if(records){try{return await records.findOne({id},{projection:{_id:0}});}catch{throw storageError();}}
  try{return JSON.parse(await readFile(/*turbopackIgnore: true*/localPath(name,id),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw storageError();}
}
export async function putRecord(name,id,value) {
  identifier(id);const records=await collection(name);const record={...value,id};
  if(records){try{await records.updateOne({id},{$set:record},{upsert:true});}catch(error){if(error.code===11000)await records.updateOne({id},{$set:record});else throw storageError();}}
  else await atomicWrite(localPath(name,id),JSON.stringify(record));
  return record;
}
export async function deleteRecord(name,id){
  identifier(id);const records=await collection(name);
  if(records){try{await records.deleteOne({id});}catch{throw storageError();}}
  else try{await unlink(/*turbopackIgnore: true*/localPath(name,id));}catch(error){if(error.code!=='ENOENT')throw storageError();}
}
function matches(record,query) {
  return Object.entries(query).every(([key,condition])=>{
    if(condition&&typeof condition==='object'&&!Array.isArray(condition))return Object.entries(condition).every(([op,value])=>op==='$in'?value.includes(record[key]):op==='$gte'?record[key]>=value:op==='$lte'?record[key]<=value:op==='$gt'?record[key]>value:false);
    return record[key]===condition;
  });
}
export async function queryRecords(name,{query={},sort={},limit=100,omitChunks=false}={}) {
  const records=await collection(name);
  if(records){try{return await records.find(query,{projection:omitChunks?{_id:0,chunks:0}:{_id:0}}).sort(sort).limit(limit).toArray();}catch{throw storageError();}}
  const directory=path.dirname(localPath(name,'directory'));
  let names;try{names=(await readdir(directory)).filter(n=>n.endsWith('.json'));}catch(error){if(error.code==='ENOENT')return [];throw storageError();}
  const result=[];
  try{for(let start=0;start<names.length;start+=20){const batch=await Promise.all(names.slice(start,start+20).map(async name=>JSON.parse(await readFile(path.join(directory,name),'utf8'))));result.push(...batch.filter(r=>matches(r,query)));}}
  catch{throw storageError();}
  result.sort((a,b)=>{for(const [key,direction]of Object.entries(sort)){if(a[key]!==b[key])return(a[key]>b[key]?1:-1)*direction;}return 0;});
  const rows=result.slice(0,limit);return omitChunks?rows.map(({chunks,...record})=>record):rows;
}
export async function saveOriginal(id,buffer) {
  const records=await collection('originals');
  if(records)await records.updateOne({id},{$set:{id,data:new Binary(buffer),contentType:'application/pdf'}},{upsert:true});
  else await atomicWrite(localPath('originals',id,'pdf'),buffer);
}
export async function getOriginal(id) {
  identifier(id);const records=await collection('originals');
  if(records){const record=await records.findOne({id});return record?.data?Buffer.from(record.data.buffer):null;}
  try{return await readFile(localPath('originals',id,'pdf'));}catch(error){if(error.code==='ENOENT')return null;throw storageError();}
}
export async function deleteOriginal(id){
  identifier(id);const records=await collection('originals');
  if(records){await records.deleteOne({id});return;}
  try{await unlink(/*turbopackIgnore: true*/localPath('originals',id,'pdf'));}catch(error){if(error.code!=='ENOENT')throw storageError();}
}
export async function getCached(id,{stale=false,maxAge=86400000}={}) {
  const record=await getRecord('cache',id);
  if(!record)return null;
  if(Date.now()>new Date(record.expiresAt).getTime()&&(!stale||Date.now()-new Date(record.storedAt).getTime()>maxAge))return null;
  return record;
}
export async function setCached(id,value,ttl) {return putRecord('cache',id,{value,storedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+ttl)});}

const localQuotas=new Map();
export async function consumeQuota(id,limit,windowEnd) {
  const records=await collection('rates');
  if(records){
    let record;try{record=await records.findOneAndUpdate({id},{$inc:{count:1},$setOnInsert:{expiresAt:new Date(windowEnd)}},{upsert:true,returnDocument:'after'});}
    catch(error){if(error.code!==11000)throw storageError();record=await records.findOneAndUpdate({id},{$inc:{count:1}},{returnDocument:'after'});}
    return !!record&&record.count<=limit;
  }
  const now=Date.now();
  for(const [key,value]of localQuotas)if(value.expiresAt<now)localQuotas.delete(key);
  const current=localQuotas.get(id)||{count:0,expiresAt:windowEnd};current.count++;localQuotas.set(id,current);return current.count<=limit;
}

const flights=new Map();
const localLeases=globalThis.__finnLocalLeases ||= new Map();
export async function withLease(id,work,{duration=90000}={}){
  identifier(id);const owner=randomUUID(),records=await collection('leases'),now=Date.now();
  if(records){
    try{await records.findOneAndUpdate({id,expiresAt:{$lte:new Date(now)}},{$set:{owner,expiresAt:new Date(now+duration)}},{upsert:true});}
    catch(error){if(error.code===11000)throw Object.assign(new Error('A filing sync is already running. Wait a moment and retry.'),{status:409,code:'SYNC_RUNNING'});throw storageError();}
  }else{
    if(localLeases.get(id)?.expiresAt>now)throw Object.assign(new Error('A filing sync is already running. Wait a moment and retry.'),{status:409,code:'SYNC_RUNNING'});
    localLeases.set(id,{owner,expiresAt:now+duration});
  }
  try{return await work();}finally{
    if(records)await records.deleteOne({id,owner}).catch(()=>{});
    else if(localLeases.get(id)?.owner===owner)localLeases.delete(id);
  }
}
export function singleFlight(key,work) {
  if(!flights.has(key))flights.set(key,Promise.resolve().then(work).finally(()=>flights.delete(key)));
  return flights.get(key);
}
