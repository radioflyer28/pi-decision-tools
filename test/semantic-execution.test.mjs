import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js';
import { Coordinator } from '../dist/core/coordinator.js';
import { ExecutionControls } from '../dist/core/controls.js';
import { ClassifierAdapter } from '../dist/pi/classifier-adapter.js';
import { SessionLedger } from '../dist/pi/session-adapter.js';
import { DEFAULT_LIMITS, jsonBytes } from '../dist/core/validation.js';
import { SemanticExecution } from '../dist/semantic/execution.js';
import { SemanticResults } from '../dist/semantic/results.js';
import { semanticEnvelopeSchema } from '../dist/semantic/schemas.js';
import { Check } from 'typebox/value';
import { QUESTIONS, recordItem } from '../dist/semantic/preparation.js';
import { temporaryFixture, FakeClassifier, FakeClock, deferred, fakeUsage } from './helpers/fixtures.mjs';
const model={type:'classifier',provider:'fake',id:'fixture',name:'Fixture',api:'fake',baseUrl:'https://fixture.invalid',input:['text'],contextWindow:10000,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
const native=(extra={})=>({api:'fake',provider:'fake',model:'fixture',stopReason:'stop',answers:{relevance:{type:'choice',choice:'match',probabilities:{match:1,no_match:0,insufficient_context:0},confidence:1}},timestamp:0,usage:fakeUsage(),...extra});
const input=(n=10,run)=>({predicate:'Supported?',records:Array.from({length:n},(_,i)=>({id:String(i),text:`record-${i}`})),...(run?{run}:{})});
async function setup(t,{actions=[],limits={},conversation=true,clock}={}){
  const f=temporaryFixture(t),session=SessionManager.create(f.root,f.sessions);
  if(conversation)session.appendMessage({role:'user',content:'Synthetic fixture.',timestamp:Date.now()});
  const ledger=new SessionLedger(session,(type,data)=>session.appendCustomEntry(type,data));
  const fake=new FakeClassifier(...actions,...Array.from({length:128},()=>async()=>native())),models=[model];
  const classifier=new ClassifierAdapter({getAvailableOfType:async()=>models,classify:fake.classify});await classifier.refresh();
  const controls=new ExecutionControls(ledger,classifier.available,{version:1,families:{generic:true,semantic:true},limits:{...DEFAULT_LIMITS,requests:100,inputBytes:1048576,concurrency:1,...limits}});
  const core=new Coordinator(controls,classifier,clock);controls.enable();return {engine:new SemanticExecution(core,clock),core,controls,fake,ledger,models};
}
const resume=(p,run={},ids)=>({operationId:p.id,expectedIdentity:p.prepared.identity,run,...(ids?{retryFailedEvidenceIds:ids}:{})});
const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};

test('ten records share nine-request cap across children; continuation preserves successes and usage',async t=>{
  const {engine,fake,ledger}=await setup(t),first=await engine.filter(input(10,{maxRequests:9}));
  const p=engine.parents.get(first.operationId);assert.equal(p.children.length,2);assert.equal(p.outcomes.filter(o=>o.status==='completed').length,9);
  assert.equal(p.stopReason,'call_limit');assert.equal(p.outcomes[9].status,'pending');assert.equal(fake.calls.length,9);assert.equal(first.usageDelta.totalTokens,90);
  const second=await engine.continue(resume(p,{maxRequests:1})),done=engine.parents.get(p.id);
  assert.equal(done.outcomes.every(o=>o.status==='completed'),true);assert.equal(fake.calls.length,10);assert.equal(second.usageDelta.totalTokens,10);
  assert.equal(done.usage[0].usage.totalTokens,100);assert.equal(ledger.snapshot().totals.chargedRequests,10);
});

test('input-byte cap is invocation-wide and exact-content reuse under new record IDs is free',async t=>{
  const {engine,fake}=await setup(t),prepared=await engine.filter(input()),p=engine.parents.get(prepared.operationId);
  const item=recordItem(p.prepared.records[0],p.prepared.predicate),bytes=jsonBytes({state:item.state,questions:QUESTIONS});
  await engine.continue(resume(p,{maxInputBytes:9*bytes}));assert.equal(fake.calls.length,9);
  const other=input(9,{maxRequests:0});other.records.forEach(r=>r.id=`other-${r.id}`);
  const reused=await engine.filter(other),r=engine.parents.get(reused.operationId);
  assert.equal(r.outcomes.every(o=>o.status==='completed'&&o.origin==='reuse'),true);assert.equal(reused.usageDelta,undefined);assert.equal(fake.calls.length,9);
});

test('globally invalid retry selection preserves all children, revision and successful judgments',async t=>{
  const actions=Array.from({length:8},()=>async()=>native());actions.push(async()=>native({stopReason:'aborted',usage:undefined}));
  const {engine,fake}=await setup(t,{actions}),result=await engine.filter(input(10,{})),p=engine.parents.get(result.operationId);
  assert.equal(p.outcomes[8].status,'failed');const revision=p.revision,failed=p.outcomes[8].id,success=p.outcomes[0].id;
  for(const ids of [[failed,success],[failed,'unknown'],[failed,failed]]){
    await assert.rejects(()=>engine.continue(resume(p,{},ids)));assert.equal(engine.parents.get(p.id).revision,revision);assert.equal(fake.calls.length,10);
  }
  await engine.continue(resume(p,{},[failed]));const done=engine.parents.get(p.id);
  assert.equal(done.outcomes[8].attempts,2);assert.equal(done.outcomes[0].attempts,1);assert.equal(fake.calls.length,11);
});

test('preparation makes no calls and nonpersisted execution retains pending parent without spending',async t=>{
  const {engine,fake}=await setup(t,{conversation:false}),prepared=await engine.filter(input());assert.equal(fake.calls.length,0);
  const p=engine.parents.get(prepared.operationId),result=await engine.continue(resume(p));
  assert.equal(result.error,'persistence_required');assert.equal(engine.parents.get(p.id).outcomes.every(o=>o.status==='pending'),true);assert.equal(fake.calls.length,0);
});

test('busy continuation rejects and cancellation drains an abort-ignoring child without a later child',async t=>{
  const gate=deferred(),{engine,core,fake}=await setup(t,{actions:[()=>gate.promise]}),prepared=await engine.filter(input());
  const p=engine.parents.get(prepared.operationId),abort=new AbortController();let settled=false;
  const running=engine.continue(resume(p),{signal:abort.signal}).then(r=>{settled=true;return r;});await flush();
  await assert.rejects(()=>engine.continue(resume(p)),{code:'search_busy'});
  abort.abort();await flush();assert.equal(settled,false);assert.equal(core.scheduler.active,1);
  gate.resolve(native({stopReason:'aborted',usage:undefined}));await running;
  assert.equal(fake.calls.length,1);assert.equal(engine.parents.get(p.id).children.length,1);assert.equal(engine.parents.get(p.id).stopReason,'cancelled');
});


test('concurrent generic work shares scheduler/session ceiling without consuming the parent lower ceiling',async t=>{
  const gate=deferred(),f=await setup(t,{limits:{concurrency:2},actions:[()=>gate.promise]});
  const prepared=await f.engine.filter(input()),p=f.engine.parents.get(prepared.operationId);
  const running=f.engine.continue(resume(p,{maxRequests:9}));await flush();
  const generic=await f.core.submit({items:[{id:'g',inputVersion:'g',state:{text:'unrelated generic'}}],rubricVersion:'semantic-v1',questions:QUESTIONS,run:{maxRequests:1}});
  assert.equal(generic.data.ok,true);gate.resolve(native());await running;
  assert.equal(f.engine.parents.get(p.id).outcomes.filter(o=>o.status==='completed').length,9);
  assert.equal(f.ledger.snapshot().totals.chargedRequests,10);assert.equal(f.fake.calls.length,10);
});

test('one monotonic deadline survives the boundary between children',async t=>{
  const fakeClock=new FakeClock(),clock={now:()=>fakeClock.now,setTimeout:fakeClock.setTimeout,clearTimeout:fakeClock.clearTimeout};
  const f=await setup(t,{clock,limits:{maxWorkMs:20,maxAttemptMs:20},actions:Array.from({length:10},()=>async()=>{fakeClock.advance(1);return native();})});
  const result=await f.engine.filter(input(10,{maxWorkMs:9})),p=f.engine.parents.get(result.operationId);
  assert.equal(f.fake.calls.length,9);assert.equal(p.stopReason,'deadline');assert.equal(p.outcomes[9].status,'pending');
  assert.equal(p.children.length,2);assert.equal(p.diagnostics.elapsedMs,9);
});

test('model policy changed at first child completion blocks creation/dispatch of a mismatched child',async t=>{
  let f;const actions=Array.from({length:7},()=>async()=>native());
  actions.push(async()=>{f.controls.select(f.models[1]);return native();});
  f=await setup(t,{actions});f.models.push({...model,id:'other'});await f.core.classifier.refresh();
  const result=await f.engine.filter(input(10,{})),p=f.engine.parents.get(result.operationId);
  assert.equal(result.error,'model_policy_mismatch');assert.equal(p.children.length,1);assert.equal(f.fake.calls.length,8);
  assert.equal(p.outcomes[8].status,'pending');assert.equal(p.prepared.model.id,'fixture');
});

test('explicit failure retries retain lifetime limits and invalid requests do not increment revision',async t=>{
  const aborted=async()=>native({stopReason:'aborted',usage:undefined});
  const {engine,fake}=await setup(t,{actions:[aborted,aborted]}),result=await engine.filter(input(1,{}));
  let p=engine.parents.get(result.operationId);const failed=p.outcomes[0].id;
  await engine.continue(resume(p,{},[failed]));p=engine.parents.get(p.id);const revision=p.revision;
  assert.equal(p.outcomes[0].attempts,2);assert.equal(p.outcomes[0].error.retryEligible,false);
  await assert.rejects(()=>engine.continue(resume(p,{},[failed])),{code:'invalid_retry_selection'});
  assert.equal(engine.parents.get(p.id).revision,revision);assert.equal(fake.calls.length,2);
});


test('actual parent execution yields schema-valid partial/failure partitions and pure subsequent views',async t=>{
  const f=await setup(t,{actions:[async()=>native({stopReason:'error',usage:undefined})]});
  const first=await f.engine.filter(input(10,{maxRequests:9})),results=new SemanticResults(f.engine.parents);
  const page=results.page({operationId:first.operationId});assert.equal(Check(semanticEnvelopeSchema,page),true);
  assert.deepEqual(page.value.coverage.initial,{total:10,judged:8,failed:1,pending:1,running:0});assert.equal(page.value.complete,false);
  assert.equal(page.value.outcomeCounts.match,8);assert.equal(page.value.items[0].status,'failed');
  const p=f.engine.parents.get(first.operationId);await f.engine.continue(resume(p,{maxRequests:1}));
  const done=results.page({operationId:p.id});assert.equal(Check(semanticEnvelopeSchema,done),true);assert.equal(done.value.complete,true);
  assert.equal(done.value.state,'complete');assert.equal(done.value.coverage.initial.failed,1);assert.equal(done.value.continuation.canResume,false);
  const before=f.fake.calls.length,refilter=results.page({operationId:p.id,policy:{version:1,minMatchProbability:1}});
  assert.equal(Check(semanticEnvelopeSchema,refilter),true);assert.equal(f.fake.calls.length,before);assert.equal('usageDelta' in refilter,false);
  const snippet=results.evidence({operationId:p.id,evidenceIds:[p.prepared.records[0].evidence.evidenceId],checkCurrent:true});
  assert.equal(snippet.ok,true);assert.equal(f.fake.calls.length,before);assert.equal('usageDelta' in snippet,false);
});
