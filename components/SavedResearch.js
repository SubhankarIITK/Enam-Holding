'use client';
import {useEffect,useRef,useState} from 'react';
import {Bookmark,LoaderCircle,Trash2,Download} from 'lucide-react';
import {workspaceFetch} from '@/lib/client-api';
import {researchMarkdown} from '@/lib/research-export';
export default function SavedResearch({ticker,answer,onOpen}){
  const [rows,setRows]=useState([]),[busy,setBusy]=useState(''),[error,setError]=useState('');const generation=useRef(0),lock=useRef(false);
  async function load(signal){const token=generation.current,r=await workspaceFetch(`/api/research/saved?ticker=${encodeURIComponent(ticker)}`,{signal});const data=await r.json();if(!r.ok)throw new Error(data.error);if(!signal?.aborted&&token===generation.current)setRows(data.analyses);}
  useEffect(()=>{generation.current++;setRows([]);setError('');setBusy('');const controller=new AbortController();load(controller.signal).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[ticker]);
  async function action(kind,id){
    if(lock.current)return;if(kind==='remove'&&!window.confirm('Remove this saved analysis? Its source documents will stay in the library.'))return;
    lock.current=true;const token=generation.current;setBusy(kind+id);setError('');
    try{
      const path=kind==='save'?'/api/research/saved':`/api/research/saved?id=${encodeURIComponent(id)}`;
      const response=await workspaceFetch(path,{method:kind==='save'?'POST':kind==='remove'?'DELETE':'GET',...(kind==='save'?{headers:{'Content-Type':'application/json'},body:JSON.stringify({analysisId:id})}:{})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);if(token!==generation.current)return;
      if(kind==='open')onOpen({...data.analysis,archived:true,notice:'Saved analysis. Its answer and source excerpts reflect the time it was generated. Ask again for fresh research.'});else await load();
    }catch(e){if(token===generation.current)setError(e.message);}finally{lock.current=false;if(token===generation.current)setBusy('');}
  }
  function download(){const blob=new Blob([researchMarkdown({...answer,ticker})],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${ticker.replace(/[^A-Z0-9&-]/g,'')}-research.md`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const saved=rows.some(r=>r.id===answer?.analysisId);
  return <section className="saved-research source-panel"><header><Bookmark size={18}/><h3>Saved research</h3></header><p>Your 20 most recent analyses, retained for 30 days in this shared workspace. Reopen a saved answer instantly without generating it again.</p>
    {answer&&!answer.demo&&<div className="saved-research-actions">{answer.analysisId&&<button className="button secondary full" disabled={!!busy||saved} onClick={()=>action('save',answer.analysisId)}>{busy.startsWith('save')?<LoaderCircle size={15} className="spin"/>:<Bookmark size={15}/>} {saved?'Saved':'Save this analysis'}</button>}<button className="text-button" onClick={download}><Download size={14}/> Export Markdown + sources</button></div>}
    {answer?.saveNotice&&<p className="small-note">{answer.saveNotice}</p>}{error&&<p className="error-text" role="alert">{error}</p>}
    <div className="saved-research-list">{rows.map(row=><article key={row.id}><button disabled={!!busy} onClick={()=>action('open',row.id)}><strong>{row.question}</strong><small>{new Date(row.savedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'})} · {row.sourceCount} sources</small></button><button className="icon-button" disabled={!!busy} aria-label={`Remove saved analysis: ${row.question}`} onClick={()=>action('remove',row.id)}><Trash2 size={14}/></button></article>)}</div>{!rows.length&&!error&&<div className="small-empty">No saved analyses for {ticker} yet.</div>}
  </section>;
}
