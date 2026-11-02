'use client';
import {useEffect,useState} from 'react';
import {LockKeyhole,LoaderCircle,ShieldCheck} from 'lucide-react';
export default function WorkspaceGate({children}){
  const [state,setState]=useState('checking'),[key,setKey]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function check(signal){try{const r=await fetch('/api/session',{signal});const data=await r.json();if(!r.ok)throw new Error(data.error);if(!signal?.aborted){setError('');setState(data.authenticated?'open':'locked');}}catch(e){if(!signal?.aborted){setError(e.message||'Workspace could not be reached.');setState('locked');}}}
  useEffect(()=>{const controller=new AbortController();async function initialize(){
    // Upgrade v0-v2 browser credentials once; retain only the HttpOnly cookie.
    const legacy=sessionStorage.getItem('finn-key');sessionStorage.removeItem('finn-key');
    if(legacy)try{await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:legacy}),signal:controller.signal});}catch{}
    await check(controller.signal);
  }initialize();const lock=()=>{setState('locked');setKey('');},visible=()=>{if(document.visibilityState==='visible')check(controller.signal);};window.addEventListener('finn:locked',lock);document.addEventListener('visibilitychange',visible);const timer=setInterval(visible,300000);return()=>{controller.abort();clearInterval(timer);window.removeEventListener('finn:locked',lock);document.removeEventListener('visibilitychange',visible);};},[]);
  if(state==='open')return children;
  return <main className="workspace-gate"><section><span className="gate-brand">FINN</span><ShieldCheck size={30}/><h1>{state==='checking'?'Opening your workspace...':'Your research. Securely kept.'}</h1><p>Sign in with your workspace access key to use research, documents and portfolio data.</p>{state==='checking'?<LoaderCircle className="spin" aria-label="Checking session"/>:<form className="form-stack" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});const data=await r.json();if(!r.ok)throw new Error(data.error);setKey('');setState('open');}catch(e){setError(e.message);}finally{setBusy(false);}}}><label>Workspace access key<input autoFocus type="password" autoComplete="current-password" required maxLength={1024} value={key} onChange={e=>setKey(e.target.value)}/></label>{error&&<p className="error-message" role="alert">{error}</p>}<button className="button primary full" disabled={busy} type="submit">{busy?<LoaderCircle className="spin" size={16}/>:<LockKeyhole size={16}/>} Open workspace</button><button className="text-button" type="button" onClick={()=>check()}>Check connection again</button></form>}<small>Your session lasts up to eight hours. Provider credentials stay on the server.</small></section></main>;
}
