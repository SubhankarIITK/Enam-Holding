'use client';
import {workspaceFetch} from '@/lib/client-api';
import {useEffect,useRef,useState} from 'react';
import {Search,LoaderCircle,FileText,Check,ExternalLink} from 'lucide-react';
export default function ImportDocumentForm({ticker:initialTicker,headers,onDone,onImported}){
  const [ticker,setTicker]=useState(initialTicker),[catalog,setCatalog]=useState(null),[selected,setSelected]=useState(''),[period,setPeriod]=useState(''),[loading,setLoading]=useState(false),[importing,setImporting]=useState(false),[error,setError]=useState(''),[imported,setImported]=useState({}),[last,setLast]=useState(null);
  const request=useRef(0),importLock=useRef(false),controller=useRef(null);
  async function find(value){
    controller.current?.abort();const current=new AbortController();controller.current=current;const token=++request.current;setLoading(true);setError('');setCatalog(null);setSelected('');setPeriod('');setLast(null);setImported({});
    try{const r=await workspaceFetch(`/api/research/sources?ticker=${encodeURIComponent(value)}`,{headers,signal:current.signal});const data=await r.json();if(!r.ok)throw new Error(data.error);if(token===request.current&&!current.signal.aborted){setCatalog(data);const first=data.candidates.find(c=>c.type==='transcript')||data.candidates[0];if(first){setSelected(first.id);setPeriod(first.period);}}}
    catch(e){if(!current.signal.aborted&&token===request.current)setError(e.message);}finally{if(token===request.current&&!current.signal.aborted)setLoading(false);}
  }
  useEffect(()=>{find(initialTicker);return()=>{request.current++;controller.current?.abort();};},[]);
  async function importSelected(){
    if(importLock.current||!selected)return;importLock.current=true;setImporting(true);setError('');
    try{const r=await workspaceFetch('/api/documents/import',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({sourceId:selected,period})});const data=await r.json();if(!r.ok)throw new Error(data.error);setImported(prev=>({...prev,[selected]:data}));setLast(data);onImported?.(data);}
    catch(e){setError(e.message);}finally{importLock.current=false;setImporting(false);}
  }
  return <div className="source-finder"><p className="muted">Find annual reports and earnings-call transcripts on NSE. Import the sources you need, then continue your research. No extra API key is required.</p>
    <form className="source-search" onSubmit={e=>{e.preventDefault();find(ticker);}}><label>NSE ticker<input value={ticker} required maxLength={25} disabled={importing} onChange={e=>{controller.current?.abort();request.current++;setLoading(false);setTicker(e.target.value.toUpperCase());setCatalog(null);setSelected('');setPeriod('');setLast(null);setImported({});setError('');}}/></label><button className="button secondary" type="submit" disabled={loading||importing}><Search size={15}/>{loading?'Searching...':'Find sources'}</button></form>
    {loading&&<div className="small-empty" role="status"><LoaderCircle className="spin" size={19}/> Checking annual reports and the past year of transcript filings...</div>}
    {error&&<p className="error-message" role="alert">{error}</p>}
    {catalog&&<><p className="small-note">{catalog.candidates.length} primary documents found for {catalog.ticker}. {catalog.stale?'Earlier saved list; NSE is unavailable.':catalog.cached?'Using a saved source list.':'Retrieved from NSE.'}</p>{catalog.warnings.map(w=><p key={w} className="source-warning">{w}</p>)}
    {!catalog.candidates.length&&<div className="small-empty">No supported PDFs were found. You can still upload an annual report or transcript from the company investor-relations website.</div>}
    <div className="source-candidates">{catalog.candidates.map(c=><article key={c.id} className={selected===c.id?'selected':''}><label><input type="radio" name="primary-source" value={c.id} checked={selected===c.id} disabled={importing} onChange={()=>{setSelected(c.id);setPeriod(c.period);setError('');}}/><span><strong>{c.type==='annual_report'?'Annual report':'Call transcript'}</strong><span>{c.period}{c.size?' / '+c.size:''}</span><small>{c.title}</small></span>{imported[c.id]&&<Check size={17} aria-label="Imported"/>}</label><a href={c.url} target="_blank" rel="noreferrer">View original <ExternalLink size={12}/></a></article>)}</div>
    {selected&&<div className="form-stack"><label>Reporting period or filing date<input value={period} maxLength={40} disabled={importing} onChange={e=>setPeriod(e.target.value)}/><small>For transcripts, the default is the filing date, not an inferred financial quarter. Change it only when the document states its reporting period.</small></label><button className="button primary full" disabled={importing||loading||!period.trim()} onClick={importSelected}>{importing?<LoaderCircle className="spin" size={16}/>:<FileText size={16}/>} {importing?'Downloading and indexing...':imported[selected]?'Re-index selected source':'Import selected source'}</button></div>}
    </>}
    {last&&<div className="import-success" role="status"><Check size={17}/><span><strong>{last.pages} pages indexed for {last.ticker}.</strong><small>{last.notice}</small></span></div>}
    <p className="small-note">Official NSE PDFs only. Server import supports up to 24 MB and 1,200 pages. PDFs over 4 MB retain extracted text and a link to the original at NSE. Scanned documents may require OCR.</p>
    {last&&<button className="button secondary full" disabled={importing} onClick={()=>onDone(last)}>Continue to research <Check size={15}/></button>}
  </div>;
}
