const stopwords=new Set('a an the what which how why does do did is are was were have has had this that company its it and or of for to me give in on at with from versus vs about major please'.split(' '));
const variants={risks:'risk',products:'product',customers:'customer',segments:'segment',profits:'profit',margins:'margin',operations:'operating',promised:'promise',manufactures:'manufacturing'};
const tokens=text=>(String(text).toLowerCase().match(/[a-z0-9]{2,}/g)||[]).filter(word=>!stopwords.has(word)).map(word=>variants[word]||word);

export function retrieve(documents,question,limit=10) {
  const query=tokens(question),text=question.toLowerCase();
  if(/cash|conversion|profit/.test(text))query.push('cash','operations','operating','pat','capex');
  if(/promise|guidance|deliver|narrative|management/.test(text))query.push('guidance','margin','growth','quarter','target','management');
  if(/chang|chnage|trajectory|trend/.test(text)||!query.length)query.push('revenue','margin','growth','guidance','cash');
  if(/business|company do|make money|sell|product/.test(text))query.push('business','product','customer','segment','manufacturing','services','revenue');
  if(/bull|bear|risk|opportunit/.test(text))query.push('risk','growth','competition','demand','outlook','debt','margin');
  if(/financial|performance|years|revenue|ebitda|pbt|pat\b/.test(text))query.push('revenue','ebitda','pbt','pat','operating','equity','borrowings');
  const terms=[...new Set(query)],frequency=new Map();
  const passages=documents.flatMap(d=>(d.chunks||[]).map((c,i)=>{
    const words=tokens(c.text),counts=new Map();for(const word of words)counts.set(word,(counts.get(word)||0)+1);
    for(const word of counts.keys())frequency.set(word,(frequency.get(word)||0)+1);
    return {id:`${d.id}-${i}`,documentId:d.id,title:d.title,url:d.url||null,type:d.type,period:d.period,page:c.page,text:c.text,demo:!!d.demo,hasOriginal:!!d.hasOriginal,words:words.length,counts};
  }));
  if(!passages.length)return [];
  const average=passages.reduce((n,p)=>n+p.words,0)/passages.length||1;
  for(const passage of passages)passage.score=terms.reduce((sum,word)=>{
    const tf=passage.counts.get(word)||0,df=frequency.get(word)||0;
    return sum+(tf?Math.log(1+(passages.length-df+.5)/(df+.5))*tf*2.2/(tf+1.2*(.25+.75*passage.words/average)):0);
  },0);
  const selected=[],perDocument=new Map(),remaining=passages.filter(p=>p.score>0);let chars=0;
  while(remaining.length&&selected.length<limit){
    remaining.sort((a,b)=>b.score/(1+(perDocument.get(b.documentId)||0)*.6)-a.score/(1+(perDocument.get(a.documentId)||0)*.6));
    const best=remaining.shift();
    if(chars+best.text.length>18000)continue;
    // Overlapping chunks should not occupy most of the context window.
    if(selected.some(p=>p.documentId===best.documentId&&p.page===best.page&&(p.text.includes(best.text)||best.text.includes(p.text))))continue;
    chars+=best.text.length;selected.push(best);perDocument.set(best.documentId,(perDocument.get(best.documentId)||0)+1);
  }
  return selected.map(({counts,words,...passage},i)=>({...passage,citation:i+1}));
}

// Pin actual financial tables before lexical ranking can crowd them out with audit boilerplate.
export function researchEvidence(documents,question){
  const ordinary=retrieve(documents,question),q=question.toLowerCase();if(!/financial|performance|year|revenue|ebitda|pbt|pat\b|profit|cash|balance|debt|ratio|margin|guidance|bull|bear/.test(q))return ordinary;
  const pinned=[];
  for(const d of documents.filter(d=>d.type==='annual_report')){
    const ranked=(d.chunks||[]).map((c,i)=>{const t=c.text.toLowerCase(),financial=['revenue','ebitda','pbt','pat'].filter(w=>new RegExp(`\\b${w}\\b`).test(t)).length;let score=financial*3+(/financial summary|financial highlights|state of affairs/.test(t)?8:0);if(/cash|conversion/.test(q))score+=/statement of cash|net cash.*operating activities/.test(t)?15:0;if(/balance|debt|ratio/.test(q))score+=/balance sheet|total equity|total current assets|total borrowings/.test(t)?12:0;if(/auditor|audit opinion|audit matters/.test(t))score-=12;return {c,i,score};}).filter(r=>r.score>=6).sort((a,b)=>b.score-a.score);
    const best=ranked[0];if(best)pinned.push({id:`${d.id}-financial-${best.i}`,documentId:d.id,title:d.title,url:d.url||null,type:d.type,period:d.period,page:best.c.page,text:best.c.text,demo:!!d.demo,hasOriginal:!!d.hasOriginal});
  }
  const selected=[],seen=new Set();let chars=0;
  for(const s of [...pinned.slice(0,4),...ordinary]){const key=s.documentId+'|'+s.page+'|'+s.text;if(seen.has(key)||selected.length>=10||chars+s.text.length>18000)continue;seen.add(key);chars+=s.text.length;selected.push({...s,citation:selected.length+1});}
  return selected;
}
