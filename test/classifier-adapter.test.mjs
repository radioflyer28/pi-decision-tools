import test from 'node:test';
import assert from 'node:assert/strict';
import { ClassifierAdapter } from '../dist/pi/classifier-adapter.js';
import { pinModel } from '../dist/core/controls.js';
import { fakeUsage, deferred } from './helpers/fixtures.mjs';
const model={type:'classifier',provider:'fake',id:'fixture',name:'Fixture',api:'fake',baseUrl:'https://fixture.invalid',
  input:['text'],contextWindow:10000,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
const questions={q:{type:'bool',instructions:'Fixture?',criteria:{true:'yes',false:'no'}}};
const response=()=>({api:model.api,provider:model.provider,model:model.id,stopReason:'stop',timestamp:0,
  answers:{q:{type:'bool',probability:0.75}},usage:fakeUsage()});

test('EX-03/22 async native discovery refreshes availability and refuses changed pinned identity',async()=>{
  let models=[model];const adapter=new ClassifierAdapter({getAvailableOfType:async kind=>{assert.equal(kind,'classifier');return models;}});
  assert.deepEqual(adapter.available(),[]);await adapter.refresh();assert.equal(adapter.available().length,1);
  const pin=pinModel(model);assert.equal((await adapter.resolve(pin)).id,model.id);
  models=[{...model,baseUrl:'https://changed.invalid'}];await assert.rejects(adapter.resolve(pin),{code:'model_policy_mismatch'});
  models=[];await assert.rejects(adapter.resolve(pin),{code:'model_unavailable'});
});

test('EX-16/17 native invocation delegates once with no internal retry, exact signal and timeout',async()=>{
  const signal=new AbortController().signal;let calls=0;
  const adapter=new ClassifierAdapter({async classify(m,context,options){calls++;assert.equal(m,model);
    assert.deepEqual(context,{state:{synthetic:true},questions});assert.equal(options.signal,signal);
    assert.equal(options.maxRetries,0);assert.equal(options.timeoutMs,12);return response();}});
  const result=await adapter.invoke(model,{synthetic:true},questions,signal,12);
  assert.equal(calls,1);assert.equal(result.outcome,'answered');assert.equal(result.answers.q.probability,0.75);
  assert.equal(result.pricing,'unknown');assert.deepEqual(result.usage,fakeUsage());
});

test('EX-17/18 only structured transient statuses permit automatic retry, never error prose',async()=>{
  for(const status of [undefined,400,401,403,408,429,500,502,503,504]){
    const adapter=new ClassifierAdapter({async classify(m,c,options){
      if(status!==undefined)options.onResponse({status,headers:{}},m);
      return {...response(),stopReason:'error',errorMessage:'PRIVATE: retry 503 temporary outage'};
    }});
    const result=await adapter.invoke(model,{},questions,new AbortController().signal,10);
    assert.equal(result.automaticRetry,[408,429,500,502,503,504].includes(status));
    assert.equal(result.outcome,'failed');assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
  }
});

test('EX-16 malformed answers and wrong actual identities are not retryable',async()=>{
  for(const change of [{model:'different'},{api:'different'},{provider:'different'},{answers:{}},{usage:{input:-1}}]){
    const adapter=new ClassifierAdapter({async classify(m,c,o){o.onResponse({status:503,headers:{}},m);return {...response(),...change};}});
    const result=await adapter.invoke(model,{},questions,new AbortController().signal,10);
    assert.equal(result.outcome,'failed');assert.equal(result.retryEligible,false);
  }
});

test('EX-20 cancellation is explicit-retry eligible, not automatically retryable; exceptions sanitized',async()=>{
  const abort=new AbortController();abort.abort();
  for(const classify of [async()=>({...response(),stopReason:'aborted'}),async()=>{throw new Error('PRIVATE');}]){
    const adapter=new ClassifierAdapter({classify});const result=await adapter.invoke(model,{},questions,abort.signal,10);
    assert.equal(result.outcome,'aborted');assert.equal(result.retryEligible,true);assert.equal(result.automaticRetry,false);
    assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
  }
});

test('EX-16 adapter preserves native choice, bool and score answers together',async()=>{
  const qs={...questions,c:{type:'choice',instructions:'Fixture label?',criteria:{a:'one',b:'two'}},
    s:{type:'score',instructions:'Fixture score?',criteria:['low','medium','high']}};
  const answers={q:{type:'bool',probability:0.8},c:{type:'choice',choice:'b',confidence:0.9,probabilities:{a:0.1,b:0.9}},
    s:{type:'score',score:1.5,confidence:0.7}};
  const adapter=new ClassifierAdapter({classify:async()=>({...response(),answers})});
  const result=await adapter.invoke(model,{},qs,new AbortController().signal,10);
  assert.equal(result.outcome,'answered');assert.deepEqual(result.answers,answers);
});

test('EX-18 authentication status forbids retry even if followed by a transient response',async()=>{
  const adapter=new ClassifierAdapter({async classify(m,c,o){
    o.onResponse({status:401,headers:{}},m);o.onResponse({status:503,headers:{}},m);
    return {...response(),stopReason:'error'};
  }});
  const result=await adapter.invoke(model,{},questions,new AbortController().signal,10);
  assert.equal(result.retryEligible,false);assert.equal(result.automaticRetry,false);
});

test('EX-06/09 concurrent refresh coalesces atomically and a failed refresh clears prior availability',async()=>{
  let gate,calls=0;
  const adapter=new ClassifierAdapter({async getAvailableOfType(){calls++;return gate?gate.promise:[model];}});
  await adapter.refresh();gate=deferred();
  const first=adapter.refresh(),second=adapter.refresh();assert.equal(first,second);assert.equal(calls,2);
  assert.equal(adapter.available().length,1);gate.resolve([model]);await Promise.all([first,second]);
  gate=deferred();const failing=adapter.refresh(),alsoFailing=adapter.resolve(pinModel(model));
  gate.reject(new Error('synthetic availability failure'));
  const outcomes=await Promise.allSettled([failing,alsoFailing]);assert.ok(outcomes.every(r=>r.status==='rejected'));
  assert.deepEqual(adapter.available(),[]);gate=undefined;await adapter.refresh();assert.equal(adapter.available().length,1);
});

test('EX-35 mismatched provider identity cannot inject raw text into usage diagnostics',async()=>{
  const privateText='PRIVATE_SYNTHETIC_RESPONSE_IDENTITY';
  const adapter=new ClassifierAdapter({classify:async()=>({...response(),provider:privateText,model:privateText})});
  const result=await adapter.invoke(model,{},questions,new AbortController().signal,10);
  assert.equal(result.code,'model_identity_mismatch');assert.equal(result.provider,'unknown');assert.equal(result.model,'unknown');
  assert.equal(JSON.stringify(result).includes(privateText),false);assert.deepEqual(result.usage,fakeUsage());
});
