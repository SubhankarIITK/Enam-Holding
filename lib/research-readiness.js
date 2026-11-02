export function researchReadiness({ticker,sample,loading,loadedTicker,documents,error}){
  if(sample)return {ready:true,count:2,state:'sample'};
  if(loading||loadedTicker!==ticker)return {ready:false,count:0,state:'loading'};
  if(error)return {ready:false,count:0,state:'error'};
  const count=documents.filter(d=>d.ticker===ticker&&!d.demo).length;
  return {ready:count>0,count,state:count?'ready':'empty'};
}
