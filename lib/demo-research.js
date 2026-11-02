import {queryRecords} from './repository.js';
export const researchDemos=[
  {ticker:'APLAPOLLO',name:'APL Apollo Tubes',focus:'Manufacturing, capacity and cash conversion',question:'Compare volume growth, margins and cash conversion. What did management promise and deliver?'},
  {ticker:'RELIANCE',name:'Reliance Industries',focus:'Diversified segments and capital allocation',question:'Explain the revenue mix, debt and capital spending. Where does reported profit turn into cash?'},
  {ticker:'TCS',name:'Tata Consultancy Services',focus:'IT services, demand and margin guidance',question:'Compare revenue growth and margin guidance with the latest reported outcomes.'}
];
export async function researchDemoStatus(){return Promise.all(researchDemos.map(async demo=>{const docs=(await queryRecords('documents',{query:{ticker:demo.ticker},limit:100,omitChunks:true})).filter(d=>!d.demo&&d.importedFrom&&d.url),annual=docs.filter(d=>d.type==='annual_report'),calls=docs.filter(d=>d.type==='transcript');return {...demo,annualReports:annual.length,transcripts:calls.length,ready:annual.length>=1&&calls.length>=4,documents:docs.map(d=>({id:d.id,title:d.title,period:d.period,type:d.type,url:d.url}))};}));}
