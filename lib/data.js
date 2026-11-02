// All numbers and events in this file are SYNTHETIC demo fixtures, not market data.
export const DEMO_AS_OF = '2026-10-27T12:00:00+05:30';
export const companies = [
  ['RELIANCE', 'Reliance Industries', 'Energy', 1482.4, 1.24, 1.3, '#426eab'],
  ['TCS', 'Tata Consultancy Services', 'Technology', 3276.5, -0.82, 0.9, '#6251a6'],
  ['HDFCBANK', 'HDFC Bank', 'Financials', 992.3, 0.64, 1.1, '#3f5d98'],
  ['INFY', 'Infosys', 'Technology', 1514.8, -3.42, 2.6, '#457ba1'],
  ['BHARTIARTL', 'Bharti Airtel', 'Telecom', 1956.2, 1.87, 1.5, '#c65a57'],
  ['LT', 'Larsen & Toubro', 'Industrials', 3821.7, 2.14, 1.8, '#76894d'],
  ['SUNPHARMA', 'Sun Pharmaceutical', 'Healthcare', 1748.6, 0.42, 0.8, '#bc8f36'],
  ['TITAN', 'Titan Company', 'Consumer', 3592.1, -0.67, 1.2, '#408080'],
  ['MARUTI', 'Maruti Suzuki', 'Automobiles', 13468, 1.36, 1.1, '#6b75a7'],
  ['ULTRACEMCO', 'UltraTech Cement', 'Materials', 11820, 0.93, 1.4, '#a17b46'],
  ['BAJFINANCE', 'Bajaj Finance', 'Financials', 982.6, -1.25, 1.5, '#6268a4'],
  ['TRENT', 'Trent', 'Consumer', 4768.9, 4.18, 2.3, '#b76262'],
  ['PERSISTENT', 'Persistent Systems', 'Technology', 5426.3, 2.21, 1.6, '#bc813e'],
  ['POLYCAB', 'Polycab India', 'Industrials', 6891.2, 0.86, 0.9, '#8a6593'],
  ['KPITTECH', 'KPIT Technologies', 'Technology', 1268.4, -2.11, 1.7, '#608944'],
  ['APLAPOLLO', 'APL Apollo Tubes', 'Materials', 1784.5, 1.72, 1.3, '#579093'],
  ['CDSL', 'Central Depository Services', 'Financials', 1428.8, 3.76, 2.8, '#7e6799'],
  ['DIXON', 'Dixon Technologies', 'Industrials', 15268.5, -0.48, 1.1, '#6d7e9a']
].map(([ticker,name,sector,price,change,volume,color]) => ({ticker,name,sector,price,change,volume,color, demo:true}));

export const categories = ['results','M&A','management_change','capex','credit_rating','dividend','earnings_call','unclassified'];
export const categoryLabels = { results:'Quarterly results', 'M&A':'Acquisition', management_change:'Leadership', capex:'Capital expenditure', credit_rating:'Credit rating', dividend:'Dividend', earnings_call:'Earnings call', unclassified:'Routine filing', price:'Price movement', volume:'Volume spike',fund_raise:'Fundraising',litigation:'Litigation / regulatory',insider_trading:'Insider transactions',investor_meetings:'Investor meetings',bonus_split:'Bonus / stock split',postal_ballot:'Postal ballot',agm_egm:'General meeting',pledging:'Share pledging',press_release:'Company update' };

export const announcements = [
  {id:'a1',ticker:'INFY',category:'results',priority:'high',hoursAgo:1,title:'Growth holds. The margin story needs a closer look.',summary:'In this sample scenario, revenue grows 8.4% YoY while EBITDA margin slips 110 bps. Read the operating performance alongside management’s guidance.',why:'Revenue growth alone misses the profitability change. Check whether the margin decline is temporary or a change in trajectory.',metrics:[['Revenue','₹42,800 cr','+8.4% YoY'],['EBITDA margin','20.6%','−110 bps YoY']],numbers:[['Revenue',42800,41600,39483],['EBITDA',8817,8861,8568],['PBT',8620,8510,8130],['PAT',6420,6300,6010]],publishedAt:'2026-10-27T10:40:00+05:30',sourceText:'SYNTHETIC RESULTS FILING — NOT AN ACTUAL INFOSYS DISCLOSURE. Revenue: current quarter 42,800 crore; previous quarter 41,600 crore; year-ago quarter 39,483 crore. EBITDA: 8,817 / 8,861 / 8,568 crore. PBT: 8,620 / 8,510 / 8,130 crore. PAT: 6,420 / 6,300 / 6,010 crore. Figures are invented for interaction testing.'},
  {id:'a2',ticker:'LT',category:'capex',priority:'high',hoursAgo:3,title:'New capacity today. Watch the cash commitment next.',summary:'A sample ₹2,400 crore capacity expansion, funded through internal accruals and debt. The balance-sheet impact matters more than the headline.',why:'Capital investment can support growth, but compare the funding mix with operating cash flow before drawing a conclusion.',metrics:[['Planned capex','₹2,400 cr','Illustrative'],['Build period','24 months','Illustrative']],publishedAt:'2026-10-27T09:10:00+05:30',sourceText:'SYNTHETIC CAPEX ANNOUNCEMENT — NOT AN ACTUAL L&T DISCLOSURE. The board has approved an illustrative 2,400 crore expansion with an indicative 24-month construction period, funded using internal accruals and borrowing. No investment conclusion should be drawn.'},
  {id:'a3',ticker:'HDFCBANK',category:'management_change',priority:'medium',hoursAgo:5,title:'A finance leadership transition to keep on your radar.',summary:'Sample CFO succession announcement. Handover timing and the incoming executive’s background are the useful follow-ups.',why:'A leadership change is a prompt to investigate continuity. This demo does not invent a real executive or biography.',publishedAt:'2026-10-27T07:00:00+05:30',sourceText:'SYNTHETIC MANAGEMENT CHANGE — NOT AN ACTUAL HDFC BANK DISCLOSURE. This fixture simulates a CFO succession announcement. No person is named. A real enrichment workflow would retrieve a verified professional background.'},
  {id:'a4',ticker:'TRENT',category:'earnings_call',priority:'medium',hoursAgo:8,title:'The transcript is where the expansion story gets tested.',summary:'Sample earnings-call transcript available. Compare the pace of store additions with the original target and cash generation.',why:'Track a specific promise through time instead of treating the latest growth commentary as a fresh fact.',publishedAt:'2026-10-27T04:00:00+05:30',sourceText:'SYNTHETIC CALL NOTICE — NOT AN ACTUAL TRENT DISCLOSURE. The illustrative earnings call discusses store expansion and cash generation. Use only real uploaded transcripts for company research.'},
  {id:'a5',ticker:'SUNPHARMA',category:'dividend',priority:'low',hoursAgo:18,title:'Dividend notice: a date for the calendar.',summary:'An illustrative dividend declaration. Kept below business-changing disclosures.',why:'Useful operational information, lower research urgency.',publishedAt:'2026-10-26T18:00:00+05:30',sourceText:'SYNTHETIC DIVIDEND NOTICE. No actual dividend or record date is asserted.'},
  {id:'a6',ticker:'TCS',category:'unclassified',priority:'low',hoursAgo:20,title:'Routine compliance certificate',summary:'Illustrative exchange paperwork, grouped to keep your inbox focused.',why:'No material operating change in this sample.',publishedAt:'2026-10-26T16:00:00+05:30',sourceText:'SYNTHETIC COMPLIANCE CERTIFICATE. Interaction fixture only.'},
  {id:'a7',ticker:'POLYCAB',category:'credit_rating',priority:'medium',hoursAgo:32,title:'Rating reaffirmed; check the outlook and rationale.',summary:'A sample rating update from the previous day. No rating action on the real company is asserted.',why:'The rationale may reveal changes in leverage or liquidity even when a headline rating stays the same.',publishedAt:'2026-10-26T04:00:00+05:30',sourceText:'SYNTHETIC CREDIT-RATING NOTICE. No actual rating is represented.'},
  {id:'a8',ticker:'RELIANCE',category:'unclassified',priority:'low',hoursAgo:50,title:'Routine investor-meeting schedule',summary:'Sample meeting notice. No fresh business information.',why:'Low urgency; included for completeness.',publishedAt:'2026-10-25T10:00:00+05:30',sourceText:'SYNTHETIC INVESTOR MEETING NOTICE. Not a real exchange filing.'}
];

export const defaultSettings = { priceThreshold:3, volumeThreshold:2, categories:['results','M&A','management_change','capex','credit_rating'], accessKey:'' };
export const researchPrompts = ['What does this business do?', 'What did management promise vs. deliver?', 'How well do profits turn into cash?', 'Give me the bull and bear case.', 'Summarise revenue, EBITDA, PBT and PAT with their reporting periods.', 'How has the business performed over the last three years?', 'Assess debt, liquidity and balance-sheet risks.', 'Compare guidance with outcomes across the last four quarters.'];

export const sampleDocuments = [
  {id:'sample-ar',ticker:'INFY',title:'Illustrative annual report',type:'annual_report',period:'FY26',demo:true,createdAt:'2026-10-27',chunks:[
    {page:1,text:'SYNTHETIC DEMO EXCERPT, NOT AN ACTUAL COMPANY REPORT. In this fictional scenario, the company provides IT consulting and digital services. Revenue was 164,000 crore versus 150,000 crore in the previous year. PAT was 24,600 crore. Operating cash flow was 26,000 crore and capital expenditure was 3,200 crore. Total debt was 4,000 crore; equity was 82,000 crore.'},
    {page:2,text:'SYNTHETIC DEMO EXCERPT. The illustrative business earns 58% of revenue from North America, 29% from Europe and 13% from other markets. Fixed-price engagements introduce delivery risk. Client concentration and discretionary technology spending are risks. These figures are fabricated.'}
  ]},
  {id:'sample-call',ticker:'INFY',title:'Illustrative earnings-call transcript',type:'transcript',period:'Q2 FY27',demo:true,createdAt:'2026-10-27',chunks:[
    {page:1,text:'SYNTHETIC DEMO EXCERPT, NOT AN ACTUAL MANAGEMENT STATEMENT. Earlier guidance in this fictional scenario targeted EBITDA margins of 21-22%. Current-quarter revenue was 42,800 crore, versus 41,600 crore last quarter and 39,483 crore a year earlier. EBITDA was 8,817 crore, producing a margin of 20.6%. Management attributed margin pressure to hiring and project ramp-up.'},
    {page:2,text:'SYNTHETIC DEMO EXCERPT. Management reiterated an illustrative full-year revenue growth range of 6-8% and expects margin recovery in the second half. This is an invented forward expectation, not a real forecast. Current quarter PAT was 6,420 crore against 6,300 crore in the prior quarter and 6,010 crore a year earlier.'}
  ]}
];
