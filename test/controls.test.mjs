import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js';
import { ExecutionControls, selectModel, pinModel } from '../dist/core/controls.js';
import { SessionLedger } from '../dist/pi/session-adapter.js';
import { DEFAULT_LIMITS } from '../dist/core/validation.js';
import { temporaryFixture, FakeClassifier } from './helpers/fixtures.mjs';
const a={provider:'fake',id:'a',api:'fixture',baseUrl:'https://a.invalid'};
const b={...a,id:'b'};
const limits={...DEFAULT_LIMITS,requests:2,inputBytes:200};
function fixture(t,{conversation=true,families={generic:true,semantic:false}}={}) {
  const f=temporaryFixture(t), session=SessionManager.create(f.root,f.sessions);
  if(conversation) session.appendMessage({role:'user',content:'Synthetic fixture.',timestamp:Date.now()});
  const ledger=new SessionLedger(session,(type,data)=>session.appendCustomEntry(type,data));
  const models=[a], stops=[];
  const config={version:1,families,limits,defaultModel:a};
  const controls=new ExecutionControls(ledger,()=>models,config,()=>stops.push('stopped'));
  return {session,ledger,controls,models,stops};
}
const deny=(fn,code)=>assert.throws(fn,{code});

test('EX-01/02 credentials and defaults are not consent; enable/disable make no grant or call',t=>{
  const {controls,ledger}=fixture(t);const fake=new FakeClassifier();
  for(const kind of ['generic','semantic','library']) deny(()=>controls.authorize(kind),'disabled');
  controls.enable();assert.equal(ledger.snapshot().events.length,0);
  controls.disable();assert.equal(controls.enabled,false);assert.equal(fake.calls.length,0);
});

test('EX-03 selection fails explicitly, never falls back from a requested missing model',()=>{
  assert.equal(selectModel([a]).id,'a');assert.equal(selectModel([a,b],undefined,b).id,'b');
  assert.equal(selectModel([a],undefined,{provider:'missing',id:'missing'}).id,'a');
  deny(()=>selectModel([]),'model_unavailable');deny(()=>selectModel([a,b]),'model_ambiguous');
  deny(()=>selectModel([a],b,a),'model_unavailable');
});

test('EX-05 early enable/preparation succeeds but readiness creates no grant before persistence',t=>{
  const {controls,ledger,session}=fixture(t,{conversation:false});
  const pinned=controls.enable();assert.deepEqual(controls.authorize('generic'),pinned);
  deny(()=>controls.ready('generic',pinned),'persistence_required');assert.equal(ledger.snapshot().events.length,0);
  session.appendMessage({role:'user',content:'Synthetic conversation.',timestamp:Date.now()});
  controls.ready('generic',pinned);assert.equal(ledger.snapshot().events.length,1);
});

test('EX-08 family switches govern internal execution without disabling independent library callers',t=>{
  for(const families of [{generic:true,semantic:false},{generic:false,semantic:true},{generic:true,semantic:true},{generic:false,semantic:false}]){
    const {controls}=fixture(t,{families});controls.enable();
    for(const kind of ['generic','semantic']) {
      if(families[kind]) assert.equal(controls.authorize(kind).id,'a');
      else deny(()=>controls.authorize(kind),'family_disabled');
    }
    assert.equal(controls.authorize('library').id,'a');
  }
});

test('EX-22 selection and changed model configuration block old pins without migration',t=>{
  const {controls,models}=fixture(t);const pinned=controls.enable();models.push(b);controls.select(b);
  deny(()=>controls.authorize('library',pinned),'model_policy_mismatch');
  controls.select(a);assert.deepEqual(controls.authorize('generic',pinned),pinned);
  models[0]={...a,baseUrl:'https://changed.invalid'};
  deny(()=>controls.authorize('generic',pinned),'model_policy_mismatch');
  models.splice(0,1);deny(()=>controls.authorize('generic',pinned),'model_unavailable');
  assert.equal(pinModel(a).backendVersionKnown,false);
  assert.ok(!JSON.stringify(pinModel(a)).includes(a.baseUrl));
});

test('EX-23 invocation caps and both shared allowance dimensions enforce zero overspend',t=>{
  const {controls,ledger}=fixture(t);const pinned=controls.enable();
  deny(()=>controls.invocation({maxRequests:3}),'limit_exceeds_user');
  deny(()=>controls.invocation({maxInputBytes:201}),'limit_exceeds_user');
  deny(()=>controls.invocation({maxWorkMs:10001}),'limit_exceeds_user');
  deny(()=>controls.reserve('generic',pinned,1,controls.invocation({maxRequests:0})),'call_limit');
  const run=controls.invocation({maxRequests:1});controls.reserve('generic',pinned,100,run);
  deny(()=>controls.reserve('generic',pinned,100,run),'call_limit');
  controls.reserve('library',pinned,100,controls.invocation({}));
  deny(()=>controls.reserve('generic',pinned,1,controls.invocation({})),'budget_exhausted');
  assert.equal(ledger.snapshot().totals.chargedRequests,2);
  assert.equal(ledger.snapshot().totals.chargedInputBytes,200);
});

test('EX-02/24/27 re-enable and replenish never reset historical charges or authorization',t=>{
  const {controls,ledger}=fixture(t);const pinned=controls.enable();
  controls.reserve('generic',pinned,100,controls.invocation({}));controls.disable();controls.enable();
  assert.equal(ledger.snapshot().totals.remainingRequests,1);
  deny(()=>controls.enable(a,{...limits,requests:3}),'limit_exceeds_user');
  controls.disable();controls.replenish(2,200);assert.equal(controls.enabled,false);
  assert.equal(ledger.snapshot().totals.remainingRequests,3);assert.equal(ledger.snapshot().totals.unknownAttempts,1);
  controls.enable(a,{...limits,requests:1});assert.equal(controls.limits.requests,1);
});

test('EX-29 final gate catches disable/abort before dispatch, leaving release proof intact',t=>{
  for(const reason of ['disabled','cancelled']){
    const {controls,ledger}=fixture(t);const pinned=controls.enable();const budget=controls.invocation({});
    const id=controls.reserve('generic',pinned,100,budget);const abort=new AbortController();
    if(reason==='disabled')controls.disable();else abort.abort();
    deny(()=>controls.beforeDispatch('generic',pinned,id,abort.signal),reason);
    ledger.releaseUndispatched(id);assert.equal(ledger.snapshot().totals.remainingRequests,2);
  }
});

test('EX-09/23 composed scheduler and controls share atomic reservations across all consumers',async t=>{
  const {FairScheduler}=await import('../dist/core/scheduler.js');
  const {deferred}=await import('./helpers/fixtures.mjs');
  const {controls,ledger}=fixture(t,{families:{generic:true,semantic:true}});
  const pin=controls.enable(),scheduler=new FairScheduler(()=>2),gate=deferred();
  const fake=new FakeClassifier(()=>gate.promise,()=>gate.promise);
  const promises=['generic','library','semantic'].flatMap(kind=>{
    const budget=controls.invocation({});
    return [0,1].map(()=>scheduler.enqueue(kind,async()=>{
      const attempt=controls.reserve(kind,pin,100,budget);
      controls.beforeDispatch(kind,pin,attempt);
      await fake.classify(pin,{state:{},questions:{}});
      ledger.settle(attempt,'answered',null,'unknown');
    }));
  });
  const settled=Promise.allSettled(promises);
  for(let i=0;i<12;i++)await Promise.resolve();
  assert.equal(fake.calls.length,2);assert.equal(fake.peak,2);assert.equal(ledger.snapshot().totals.remainingRequests,0);
  gate.resolve({});const results=await settled;
  assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
  for(const result of results.filter(r=>r.status==='rejected'))assert.equal(result.reason.code,'budget_exhausted');
  assert.equal(fake.calls.length,2);assert.equal(ledger.snapshot().totals.chargedInputBytes,200);
});
