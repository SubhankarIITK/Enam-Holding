import {annualTableFigures,statementFigures} from './annual-table.js';
const clean=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();
// These are an index of facts already printed in the supplied passages, not a new source.
export function checkedResearchFacts(documents,sources,question=''){
  const facts=[],seen=new Set(),standalone=/standalone/i.test(question);
  for(const document of documents.filter(d=>d.type==='annual_report'))for(const f of [...annualTableFigures(document),...statementFigures(document)]){
    if(standalone?f.basis!=='Standalone':f.basis==='Standalone')continue;
    const source=sources.find(s=>s.documentId===document.id&&s.page===f.source.page&&clean(s.text).includes(clean(f.source.text)));if(!source)continue;
    const key=[f.metric,f.periodEnd,f.unit,f.basis].join('|');if(seen.has(key))continue;seen.add(key);facts.push({metric:f.metric,value:f.value,unit:f.unit,basis:f.basis,periodType:f.periodType,periodEnd:f.periodEnd,citation:source.citation});if(facts.length>=32)return facts;
  }
  return facts;
}
