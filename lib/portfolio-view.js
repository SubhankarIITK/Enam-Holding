export function portfolioView(holdings,companies,prices,mode='live'){
  return holdings.map(ticker=>{
    const company=companies.find(c=>c.ticker===ticker)||{ticker,name:ticker,sector:'Added company',color:'#4F8EF7'};
    if(mode==='sample'&&company.demo)return company;
    return {...company,price:null,change:0,volume:0,history:[],series:[],demo:false,...prices[ticker]};
  });
}
