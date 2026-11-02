'use client';
import {workspaceFetch} from '@/lib/client-api';
import {useEffect,useRef,useState} from 'react';
import {BarChart3,Plus,RefreshCw,FileText,Trash2} from 'lucide-react';
import {Plot} from './Charts';

const metrics=['Revenue','PAT','PBT','EBITDA','Operating cash flow','Capital expenditure','Total debt','Cash balance','EBITDA margin'];
const initial={documentId:'',page:1,metric:'Revenue',value:'',unit:'INR crore',periodType:'Quarter',periodEnd:'',periodLabel:'',quote:''};
export default function DocumentFinancials({ticker,documents,accessKey,onSource,onAddDocument}){
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState(false),[form,setForm]=useState(initial),[passages,setPassages]=useState([]),[selection,setSelection]=useState('');
  const generation=useRef(0),saving=useRef(false);
  const headers={'x-finn-key':accessKey};
  const primaryDocuments=documents.filter(d=>d.ticker===ticker&&!d.demo);
  async function load(signal){
    try{const response=await workspaceFetch(`/api/financials?ticker=${encodeURIComponent(ticker)}`,{headers,signal});const data=await response.json();if(!response.ok)throw new Error(data.error);if(!signal?.aborted){setRows(data.figures);if(data.truncated)setError('Showing the first 1,000 saved figures.');}}
    catch(e){if(e.name!=='AbortError')setError(e.message);}
  }
  useEffect(()=>{const controller=new AbortController();generation.current++;setRows([]);setError('');setEditing(false);setForm(initial);setPassages([]);load(controller.signal);return()=>controller.abort();},[ticker,accessKey]);
  useEffect(()=>{setPassages([]);if(!form.documentId)return;const controller=new AbortController();workspaceFetch(`/api/documents/${encodeURIComponent(form.documentId)}/page?page=${form.page}`,{headers,signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(!controller.signal.aborted)setPassages(d.passages);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>controller.abort();},[form.documentId,form.page,accessKey]);
  const groups=[...new Set(rows.map(r=>[r.metric,r.unit,r.periodType].join('|')))];
  const group=groups.includes(selection)?selection:groups[0];
  const series=rows.filter(r=>[r.metric,r.unit,r.periodType].join('|')===group).sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd)).slice(-12);
  const update=(key,value)=>setForm(f=>({...f,[key]:value}));
  async function save(e){
    e.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);setError('');const token=generation.current;
    try{const response=await workspaceFetch('/api/financials',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({...form,value:Number(form.value)})});const data=await response.json();if(!response.ok)throw new Error(data.error);if(token===generation.current){setRows(prev=>[...prev.filter(r=>r.id!==data.figure.id),data.figure]);setSelection([data.figure.metric,data.figure.unit,data.figure.periodType].join('|'));setEditing(false);}}
    catch(e){if(token===generation.current)setError(e.message);}finally{saving.current=false;setBusy(false);}
  }
  function source(row){onSource({documentId:row.documentId,ticker,title:row.title,period:row.periodLabel,page:row.page,text:row.quote,url:row.url,hasOriginal:row.hasOriginal,demo:false});}
  async function remove(row){
    if(!window.confirm(`Remove ${row.metric} for ${row.periodLabel}? The source document stays in your library.`))return;
    const token=generation.current;setError('');
    try{const response=await workspaceFetch(`/api/financials?id=${row.id}`,{method:'DELETE',headers});const data=await response.json();if(!response.ok)throw new Error(data.error);if(token===generation.current)setRows(prev=>prev.filter(r=>r.id!==row.id));}
    catch(e){if(token===generation.current)setError(e.message);}
  }
  return <section className="chart-card document-financials"><header><div><span className="eyebrow">FROM YOUR DOCUMENTS</span><h3><BarChart3 size={18}/> {ticker} financial figures</h3></div><button className="button secondary" onClick={()=>{setError('');setEditing(!editing);}}><Plus size={15}/>{editing?'Close entry':'Add figure'}</button></header>
    <p className="chart-provenance">User-reviewed figures, linked to a document page. FINN checks that the excerpt and number exist in the extracted text; you confirm the metric, period and unit.</p>
    {error&&<p className="error-message" role="alert">{error}</p>}
    {editing&&(!primaryDocuments.length?<div className="small-empty">Add an annual report or transcript for {ticker} first. <button className="text-button" onClick={onAddDocument}>Add document</button></div>:<form className="figure-form form-stack" onSubmit={save}>
      <label>Primary document<select required value={form.documentId} onChange={e=>setForm(f=>({...f,documentId:e.target.value,page:1,quote:''}))}><option value="">Select a document</option>{primaryDocuments.map(d=><option key={d.id} value={d.id}>{d.title} · {d.period}</option>)}</select></label>
      <div className="figure-grid"><label>Page<input type="number" min="1" max="1200" required value={form.page} onChange={e=>setForm(f=>({...f,page:Number(e.target.value),quote:''}))}/></label><label>Metric<select value={form.metric} onChange={e=>{update('metric',e.target.value);update('unit',e.target.value==='EBITDA margin'?'%':'INR crore');}}>{metrics.map(m=><option key={m}>{m}</option>)}</select></label><label>Value as printed<input type="number" step="any" required value={form.value} onChange={e=>update('value',e.target.value)} placeholder="42800"/></label><label>Source unit<select value={form.unit} onChange={e=>update('unit',e.target.value)}>{['INR crore','INR million','INR billion','USD million','%'].map(u=><option key={u}>{u}</option>)}</select></label><label>Period type<select value={form.periodType} onChange={e=>update('periodType',e.target.value)}>{['Quarter','Year','As of'].map(p=><option key={p}>{p}</option>)}</select></label><label>Period end<input type="date" required value={form.periodEnd} onChange={e=>update('periodEnd',e.target.value)}/></label><label>Period label<input required maxLength={40} value={form.periodLabel} placeholder="Q2 FY27" onChange={e=>update('periodLabel',e.target.value)}/></label></div>
      {passages.length>0&&<details className="extracted-page"><summary><FileText size={14}/> Read extracted page {form.page}</summary>{passages.map((p,i)=><pre key={i}>{p.text}</pre>)}</details>}
      <label>Supporting excerpt<textarea required minLength={20} maxLength={2000} rows={4} value={form.quote} onChange={e=>update('quote',e.target.value)} placeholder="Copy a passage from the extracted page above containing this exact figure and its context."/></label><p className="small-note">Keep source units. The same metric, unit, period type and date replaces the existing figure. Different units and annual versus quarterly figures are charted separately.</p><button className="button primary" type="submit" disabled={busy}>{busy?<RefreshCw size={15} className="spin"/>:<Plus size={15}/>} Save reviewed figure</button>
    </form>)}
    {groups.length>0?<><div className="chart-subheader"><select aria-label="Financial series" value={group} onChange={e=>setSelection(e.target.value)}>{groups.map(g=><option key={g} value={g}>{g.split('|').join(' · ')}</option>)}</select><span className="source-badge">Excerpt matched · user reviewed</span></div><Plot key={group+series.map(r=>r.value).join(',')} points={series.map(r=>({label:r.periodLabel,value:r.value}))} kind="bar" label={`${ticker} ${group.split('|').join(', ')}, user-reviewed figures`}/><p className="chart-provenance">Values in {series[0]?.unit}. Showing up to 12 latest periods. Open each source to check the context.</p><div className="figure-evidence">{series.map(r=><div className="figure-evidence-row" key={r.id}><button onClick={()=>source(r)}><span><strong>{r.periodLabel} · {r.value.toLocaleString('en-IN')} {r.unit}</strong><small>{r.title} · page {r.page}</small></span><FileText size={16}/></button><button className="icon-button" aria-label={`Remove ${r.metric} ${r.periodLabel}`} onClick={()=>remove(r)}><Trash2 size={15}/></button></div>)}</div></>:!editing&&<div className="small-empty">No reviewed figures yet. Add figures from your primary documents to build a chart. Missing financial data stays empty.</div>}
  </section>;
}
