// Deterministic illustration only; never used to fill missing fetched history.
export function samplePriceSeries(company) {
  if(!company?.demo||!Number.isFinite(company.price)) return [];
  const seed=[...company.ticker].reduce((sum,char)=>sum+char.charCodeAt(0),0);
  const dates=[];const day=new Date('2026-10-26T00:00:00Z');
  while(dates.length<60){if(day.getUTCDay()!==0&&day.getUTCDay()!==6)dates.unshift(day.toISOString().slice(0,10));day.setUTCDate(day.getUTCDate()-1);}
  const baseline=800000+seed*1000;
  const shape=i=>1+Math.sin(i*.55+seed)*.008+Math.cos(i*.17)*.016+(i-59)*.0008;
  return dates.map((date,i)=>({date,close:company.price*shape(i)/shape(59),volume:Math.round(baseline*(.8+Math.abs(Math.sin(i*.4+seed))*.5)*(i===59?company.volume:1))}));
}

export function marketSeries(rows) {
  return rows.slice(-60).map(row=>({date:new Date(row.time*1000).toISOString().slice(0,10),close:row.close,volume:row.volume}));
}

export function quarterlyComparison(rows,metric) {
  const row=rows.find(row=>row[0]===metric);
  if(!row)return [];
  return [{label:'Year-ago Q',value:row[3]},{label:'Prior Q',value:row[2]},{label:'Current Q',value:row[1]}];
}
