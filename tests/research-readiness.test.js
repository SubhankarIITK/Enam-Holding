import test from 'node:test';
import assert from 'node:assert/strict';
import {researchReadiness} from '../lib/research-readiness.js';
const state={ticker:'APLAPOLLO',sample:false,loading:false,loadedTicker:'APLAPOLLO',documents:[],error:''};
test('research cannot submit before sources for the selected ticker are loaded',()=>{
  assert.equal(researchReadiness(state).state,'empty');
  assert.equal(researchReadiness({...state,documents:[{ticker:'INFY'}]}).ready,false);
  assert.equal(researchReadiness({...state,documents:[{ticker:'APLAPOLLO',demo:true}]}).ready,false);
  assert.equal(researchReadiness({...state,loadedTicker:'INFY'}).state,'loading');
  assert.equal(researchReadiness({...state,loading:true}).ready,false);
  assert.equal(researchReadiness({...state,error:'Failed to load'}).state,'error');
  assert.equal(researchReadiness({...state,documents:[{ticker:'APLAPOLLO',demo:false}]}).ready,true);
  assert.equal(researchReadiness({...state,sample:true}).ready,true);
});
