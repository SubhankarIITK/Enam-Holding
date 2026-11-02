'use client';

import {useId,useState} from 'react';
import {RefreshCw,BarChart3,ArrowUpRight} from 'lucide-react';
import {samplePriceSeries,quarterlyComparison} from '@/lib/charts';
import {announcements,sampleDocuments} from '@/lib/data';

const number=(n,max=2)=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:max}).format(n);
const short=n=>Math.abs(n)>=10000000?`${number(n/10000000,1)}Cr`:Math.abs(n)>=100000?`${number(n/100000,1)}L`:number(n,0);
const dateLabel=date=>new Date(date+'T00:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'});

export function Plot({points,kind='line',label,unit='',format=number}) {
  const id=useId().replaceAll(':','');
  const [active,setActive]=useState(null),[showData,setShowData]=useState(false);
  const w=720,h=254,left=65,right=22,top=24,bottom=39,pw=w-left-right,ph=h-top-bottom;
  const values=points.map(p=>p.value),low=kind==='bar'?Math.min(0,...values):Math.min(...values),high=Math.max(0,...values);
  const pad=kind==='bar'?0:(high-low)*.15||Math.abs(high)*.02||1;
  const min=low-pad,max=high+pad||1,span=max-min||1;
  const x=i=>left+(kind==='bar'?(i+.5)/points.length:i/Math.max(1,points.length-1))*pw;
  const y=value=>top+(max-value)/span*ph;
  const line=points.map((p,i)=>`${x(i)},${y(p.value)}`).join(' ');
  const current=points[active??points.length-1];
  const ticks=[0,1,2,3,4].map(i=>max-span*i/4);
  return <div className="plot"><div className="plot-reading" aria-live="polite"><span>{current?.label}</span><strong>{unit}{current?format(current.value):'—'}</strong></div><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} tabIndex={0} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setActive(i=>e.key==='Home'?0:e.key==='End'?points.length-1:Math.min(points.length-1,Math.max(0,(i??points.length-1)+(e.key==='ArrowLeft'?-1:1))));}}} onPointerMove={e=>{const rect=e.currentTarget.getBoundingClientRect();const relative=(e.clientX-rect.left)/rect.width*w;setActive(Math.max(0,Math.min(points.length-1,Math.round((relative-left)/pw*(points.length-1)))));}} onPointerLeave={()=>setActive(null)}>
      <title>{label}. Hover, touch, or use arrow keys to inspect values.</title>
      <defs><linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4F8EF7" stopOpacity=".22"/><stop offset="100%" stopColor="#4F8EF7" stopOpacity=".01"/></linearGradient></defs>
      {ticks.map((v,i)=><g key={i}><line x1={left} x2={w-right} y1={y(v)} y2={y(v)} stroke="#26364B" strokeDasharray="3 5"/><text x={left-12} y={y(v)+4} textAnchor="end" fill="#94A3B8" fontSize="11">{format(v)}</text></g>)}
      {kind==='line'?<><polygon points={`${x(0)},${h-bottom} ${line} ${x(points.length-1)},${h-bottom}`} fill={`url(#fill-${id})`}/><polyline points={line} fill="none" stroke="#2DD4BF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></>:points.map((p,i)=>{const width=Math.min(75,pw/points.length*.62);return <rect key={i} x={x(i)-width/2} y={Math.min(y(p.value),y(0))} width={width} height={Math.max(1,Math.abs(y(p.value)-y(0)))} rx="3" fill={i===(active??points.length-1)?'#4F8EF7':'#294D7A'}/>;})}
      {points.map((p,i)=>(kind==='bar'&&points.length<8)||i===0||i===points.length-1||(points.length>15&&i===Math.floor(points.length/2))?<text key={i} x={x(i)} y={h-12} textAnchor="middle" fill="#94A3B8" fontSize="11">{p.label}</text>:null)}
      {active!==null&&points[active]&&<g><line x1={x(active)} x2={x(active)} y1={top} y2={h-bottom} stroke="#4F8EF7" strokeDasharray="4 4"/>{kind==='line'&&<circle cx={x(active)} cy={y(points[active].value)} r="4.5" fill="#2DD4BF" stroke="white" strokeWidth="2"/>}</g>}
    </svg><div className="plot-footer"><span>Hover, touch or use ← → to inspect</span><button onClick={()=>setShowData(!showData)} aria-expanded={showData}>{showData?'Hide':'View'} data table</button></div>{showData&&<div className="markdown-table plot-data"><table><caption className="sr-only">{label}</caption><thead><tr><th>Period</th><th>Value {unit&&`(${unit})`}</th></tr></thead><tbody>{points.map((p,i)=><tr key={i}><td>{p.label}</td><td>{unit}{number(p.value)}</td></tr>)}</tbody></table></div>}</div>;
}

export function PortfolioCharts({companies,onRefresh,refreshing,selectedTicker='INFY',onSelectTicker}) {
  const [range,setRange]=useState(20),[metric,setMetric]=useState('close');
  const ticker=selectedTicker,setTicker=onSelectTicker||(()=>{});
  const company=companies.find(c=>c.ticker===ticker)||companies[0];
  if(!company)return null;
  const series=(company.demo?samplePriceSeries(company):company.series||[]).slice(-range);
  const points=series.map(p=>({label:dateLabel(p.date),value:p[metric]}));
  return <section id="portfolio-chart" className="chart-card portfolio-chart"><header><div><span className="eyebrow">THE SHAPE OF THE MOVE</span><h2><BarChart3 size={18}/> Price & volume</h2></div><div className="chart-toolbar"><select aria-label="Chart company" value={company.ticker} onChange={e=>setTicker(e.target.value)}>{companies.map(c=><option key={c.ticker}>{c.ticker}</option>)}</select><button className="button secondary" disabled={!!refreshing} onClick={()=>onRefresh(company.ticker)}><RefreshCw size={14} className={refreshing===company.ticker?'spin':''}/> Update prices</button></div></header><div className="chart-subheader"><span className={company.demo?'demo-badge':'source-badge'}>{company.demo?'Illustrative sample':series.length?(company.stale?(company.staleReason==='age'?'Saved EOD - refresh recommended':'Saved EOD - provider offline'):company.cached?'Cached daily sessions':'Fetched daily sessions'):'No history fetched'}</span><div className="chart-options"><div className="chart-tabs">{[['close','Price'],['volume','Volume']].map(([key,label])=><button key={key} className={metric===key?'active':''} onClick={()=>setMetric(key)}>{label}</button>)}</div><div className="chart-tabs">{[[20,'1M'],[60,'3M']].map(([value,label])=><button key={value} className={range===value?'active':''} onClick={()=>setRange(value)}>{label}</button>)}</div></div></div>{points.length>1?<Plot key={`${company.ticker}-${range}-${metric}`} points={points} kind={metric==='volume'?'bar':'line'} label={`${company.ticker} ${metric==='close'?'daily close prices in rupees':'daily traded volume in shares'}${company.demo?', synthetic sample':''}`} unit={metric==='close'?'₹':''} format={metric==='volume'?short:number}/>:<div className="small-empty">Fetch this company’s EOD data to view its price and volume history.</div>}<p className="chart-provenance">{company.demo?'Synthetic series for demonstrating interaction. These are not historical market prices.':`Yahoo Finance · completed NSE daily sessions${company.asOf?' · through '+new Date(company.asOf).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'}):''}.`} {range===20?'Up to 20':'Up to 60'} trading sessions.</p></section>;
}

export function FinancialCharts({onSource}) {
  const [metric,setMetric]=useState('Revenue'),[mode,setMode]=useState('quarterly');
  const rows=announcements.find(a=>a.id==='a1').numbers;
  const points=mode==='quarterly'?quarterlyComparison(rows,metric):[{label:'PAT',value:24600},{label:'Operating cash',value:26000},{label:'Capex',value:3200},{label:'Free cash flow',value:22800}];
  const doc=sampleDocuments.find(d=>d.id===(mode==='cash'?'sample-ar':'sample-call'));
  const chunk=doc.chunks.find(c=>c.page===(metric==='PAT'&&mode==='quarterly'?2:1));
  return <section className="chart-card financial-chart"><header><div><span className="eyebrow">SEE THE NUMBERS</span><h3>{mode==='quarterly'?'Quarterly comparison':'Profit into cash · FY26'}</h3></div><span className="demo-badge">Synthetic sample</span></header><div className="chart-subheader"><div className="chart-tabs"><button className={mode==='quarterly'?'active':''} onClick={()=>setMode('quarterly')}>Quarterly</button><button className={mode==='cash'?'active':''} onClick={()=>setMode('cash')}>Cash quality</button></div>{mode==='quarterly'&&<select aria-label="Financial chart metric" value={metric} onChange={e=>setMetric(e.target.value)}><option>Revenue</option><option>PAT</option></select>}</div><Plot key={`${mode}-${metric}`} points={points} kind="bar" label={`${mode==='quarterly'?metric+' quarterly comparison':'Annual profit, cash flow and capex'}, synthetic figures in rupees crore`} unit="₹" format={n=>number(n,0)}/><div className="chart-provenance"><span>₹ crore · {mode==='cash'?'FCF = operating cash − capex. Annual figures.':'Year-ago quarter → previous quarter → current quarter. Not three consecutive quarters.'} Invented figures.</span><button onClick={()=>onSource({...chunk,title:doc.title,period:doc.period,demo:true})}>View sample evidence <ArrowUpRight size={13}/></button></div></section>;
}
