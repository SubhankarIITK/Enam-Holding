export function normalizeTicker(value) {
  const ticker = String(value || '').trim().toUpperCase().replace(/\.(NS|BO)$/, '');
  if (!/^[A-Z0-9][A-Z0-9&-]{0,24}$/.test(ticker)) throw new Error('Enter a valid NSE ticker, for example INFY or M&M.');
  return ticker;
}

export function percentChange(current, previous) {
  return previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100;
}

export function makeAlerts(portfolio, settings) {
  return portfolio.flatMap(c => {
    const alerts=[];
    if (Math.abs(c.change) >= Number(settings.priceThreshold)) alerts.push({id:`price-${c.ticker}`,ticker:c.ticker,type:'price',title:`${c.ticker} ${c.change > 0 ? 'up' : 'down'} ${Math.abs(c.change).toFixed(2)}%`,detail:`Crossed your ±${settings.priceThreshold}% daily price threshold.`,value:c.change,demo:c.demo});
    if (c.volume >= Number(settings.volumeThreshold)) alerts.push({id:`volume-${c.ticker}`,ticker:c.ticker,type:'volume',title:`${c.ticker} volume at ${c.volume.toFixed(1)}×`,detail:`Versus the preceding 20 sessions; your threshold is ${settings.volumeThreshold}×.`,value:c.volume,demo:c.demo});
    return alerts;
  });
}

export function filterAnnouncements(items, {hours=24,category='all',ticker='all',query=''}={}) {
  const rank={high:0,medium:1,low:2};
  return items.filter(a => a.hoursAgo <= Number(hours) && (category==='all'||a.category===category) && (ticker==='all'||a.ticker===ticker) && `${a.ticker} ${a.title} ${a.summary}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>rank[a.priority]-rank[b.priority]||a.hoursAgo-b.hoursAgo);
}

export function chunkText(text, page=1) {
  const clean=String(text).replace(/\r\n?/g,'\n').replace(/[^\S\n]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  const chunks=[];
  for(let start=0;start<clean.length;start+=1000) {
    chunks.push({page,text:clean.slice(start,start+1200)});
    if(start+1200>=clean.length) break;
  }
  return chunks;
}

export {retrieve} from './retrieval.js';

function researchError(message) {
  return Object.assign(new Error(message),{code:'RESEARCH_FORMAT'});
}

export function normalizeCitations(answer) {
  // Accept common model citation styles, preserving the exact referenced IDs.
  // Never assign a source to an uncited claim or change an unknown ID to a known one.
  return answer.replace(/【([^【】]+)】|［([^［］]+)］/g,(original,a,b)=>/^\s*(?:sources?\s*)?\d+(?:\s*[,;–—-]\s*\d+)*\s*$/i.test(a||b)?`[${(a||b).trim()}]`:original).replace(/\[(?:sources?\s*)?(\d+(?:\s*(?:,|;|[-–—])\s*\d+)*)\]/gi, (original,group)=>{
    const ids=[];
    for(const part of group.split(/[,;]/)) {
      const range=part.trim().match(/^(\d+)\s*[-–—]\s*(\d+)$/);
      if(range) {
        const start=Number(range[1]),end=Number(range[2]);
        if(end<start||end-start>20) return original;
        for(let id=start;id<=end;id++) ids.push(id);
      } else ids.push(Number(part.trim()));
    }
    return [...new Set(ids)].map(id=>`[${id}]`).join(' ');
  });
}

export function validateResearch(raw, sources) {
  if(!raw || typeof raw.answer!=='string' || !raw.answer.trim() || (raw.citations!==undefined&&!Array.isArray(raw.citations))) throw researchError('The model returned an invalid research response.');
  // Some JSON-mode completions escape Markdown line breaks twice. Decode only
  // this text-level variant; never run eval or decode the whole response again.
  const text=!raw.answer.includes('\n')&&raw.answer.includes('\\n')?raw.answer.replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n'):raw.answer;
  const answer=normalizeCitations(text);
  const available=new Set(sources.map(s=>s.citation));
  const declared=[...new Set((raw.citations||[]).map(id=>typeof id==='string'&&/^\d+$/.test(id)?Number(id):id))];
  if(declared.some(id=>!Number.isInteger(id)||!available.has(id))) throw researchError('The response contained an unverified source reference.');
  // Inline references determine which evidence the reader actually sees. A
  // model's redundant citations array can omit or include unused valid IDs.
  const prose=answer.replace(/```[\s\S]*?```/g,'').replace(/`[^`]*`/g,'');
  const inline=[...new Set([...prose.matchAll(/\[(\d+)\]/g)].map(m=>Number(m[1])))];
  if(inline.some(id=>!available.has(id))) throw researchError('The response contained an unverified inline source reference.');
  const insufficientEvidence=raw.insufficientEvidence===true;
  if(!inline.length&&!insufficientEvidence) throw researchError('The response is missing inline evidence references.');
  return {answer,citations:inline,insufficientEvidence};
}
