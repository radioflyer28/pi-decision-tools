import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js';
import { Coordinator } from '../dist/core/coordinator.js';
import { ExecutionControls } from '../dist/core/controls.js';
import { ClassifierAdapter } from '../dist/pi/classifier-adapter.js';
import { SessionLedger } from '../dist/pi/session-adapter.js';
import { DEFAULT_LIMITS, jsonBytes } from '../dist/core/validation.js';
import { ToolkitError } from '../dist/core/errors.js';
import { temporaryFixture, FakeClassifier, FakeClock, deferred, fakeUsage } from './helpers/fixtures.mjs';
const model={type:'classifier',provider:'fake',id:'fixture',name:'Fixture',api:'fake',baseUrl:'https://fixture.invalid',
  input:['text'],contextWindow:10000,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
const input=(count=2,run)=>({items:Array.from({length:count},(_,i)=>({id:String(i),inputVersion:'1',state:{index:i}})),
  rubricVersion:'v1',questions:{q:{type:'bool',instructions:'Fixture?',criteria:{true:'yes',false:'no'}}},...(run?{run}:{})});
const native=(extra={})=>({api:'fake',provider:'fake',model:'fixture',stopReason:'stop',answers:{q:{type:'bool',probability:0.7}},timestamp:0,usage:fakeUsage(),...extra});
async function setup(t,{conversation=true,limits={},actions=[]}={}){
  const f=temporaryFixture(t),session=SessionManager.create(f.root,f.sessions);
  if(conversation)session.appendMessage({role:'user',content:'Synthetic fixture.',timestamp:Date.now()});
  const ledger=new SessionLedger(session,(type,data)=>session.appendCustomEntry(type,data));
  const fake=new FakeClassifier(...actions),models=[model];
  const classifier=new ClassifierAdapter({getAvailableOfType:async()=>models,classify:fake.classify});
  await classifier.refresh();
  const controls=new ExecutionControls(ledger,classifier.available,{version:1,families:{generic:true,semantic:true},
    limits:{...DEFAULT_LIMITS,requests:20,inputBytes:100000,...limits}});
  const coordinator=new Coordinator(controls,classifier);controls.enable();
  return {coordinator,controls,ledger,fake,session,models};
}
const value=result=>{assert.equal(result.data.ok,true,JSON.stringify(result.data));return result.data.value;};
const resume=(page,run={},retryFailedIds)=>({batchId:page.batchId,expectedIdentity:page.identity,run,...(retryFailedIds?{retryFailedIds}:{})});
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};

test('EX-01/05 prepared batches require authorization, execute only after persistence, and retain error handles',async t=>{
  const {coordinator,controls,fake}=await setup(t,{conversation:false});controls.disable();
  assert.equal((await coordinator.submit(input())).data.error.code,'disabled');assert.equal(coordinator.workspaces.size,0);
  controls.enable();const prepared=value(await coordinator.submit(input()));assert.equal(prepared.state,'prepared');
  const blocked=await coordinator.submit(input(1,{}));assert.equal(blocked.data.error.code,'persistence_required');
  assert.ok(blocked.data.batch.batchId);assert.equal(fake.calls.length,0);
});

test('EX-12/13 one-shot lower cap, pending-only continuation, and free retrieval preserve usage deltas',async t=>{
  const {coordinator,fake,ledger}=await setup(t,{limits:{concurrency:1}});
  const first=await coordinator.submit(input(2,{maxRequests:1})),page=value(first);
  assert.equal(page.state,'partial');assert.equal(page.stopReason,'call_limit');assert.equal(page.counts.completed,1);
  assert.equal(first.usageDelta.totalTokens,10);
  const second=await coordinator.continue(resume(page,{maxRequests:1})),done=value(second);
  assert.equal(done.state,'complete');assert.equal(done.counts.completed,2);assert.equal(fake.calls.length,2);
  assert.equal(second.usageDelta.totalTokens,10);assert.equal(done.usage[0].usage.totalTokens,20);
  const read=coordinator.results({batchId:done.batchId});assert.equal(read.usageDelta,undefined);
  assert.equal(ledger.snapshot().totals.chargedRequests,2);
});

test('EX-14 rejected continuation never mutates batch revision or successful outcomes',async t=>{
  const {coordinator}=await setup(t);const page=value(await coordinator.submit(input(1,{})));
  const before=coordinator.workspaces.get(page.batchId).revision;
  assert.equal((await coordinator.continue({...resume(page),expectedIdentity:'wrong'})).data.error.code,'identity_mismatch');
  assert.equal((await coordinator.continue(resume(page,{},['0']))).data.error.code,'invalid_retry_selection');
  assert.equal(coordinator.workspaces.get(page.batchId).revision,before);
  assert.equal(value(coordinator.results({batchId:page.batchId})).counts.completed,1);
});

test('EX-15 same-generation exact evidence reuse ignores item ID and consumes no new charge or usage delta',async t=>{
  const {coordinator,fake,ledger}=await setup(t);const first=value(await coordinator.submit(input(1,{})));
  const raw=input(1,{});raw.items[0].id='different';const reused=await coordinator.submit(raw),page=value(reused);
  assert.equal(page.items[0].origin,'reuse');assert.equal(page.items[0].judgmentId,first.items[0].judgmentId);
  assert.equal(page.diagnostics.cacheHits,1);assert.equal(reused.usageDelta,undefined);assert.equal(fake.calls.length,1);
  raw.items[0].inputVersion='2';value(await coordinator.submit(raw));assert.equal(fake.calls.length,2);
  assert.equal(ledger.snapshot().totals.chargedRequests,2);
});

test('EX-16/18 complete-with-failures does not automatically retry malformed answers or prose errors',async t=>{
  for(const result of [native({answers:{}}),native({stopReason:'error',errorMessage:'PRIVATE: temporary retry 503'})]){
    const {coordinator,fake}=await setup(t,{actions:[async()=>result]});
    const page=value(await coordinator.submit(input(1,{})));
    assert.equal(page.state,'complete');assert.equal(page.counts.failed,1);assert.equal(fake.calls.length,1);
    assert.equal(page.items[0].error.retryEligible,false);assert.equal(JSON.stringify(page).includes('PRIVATE'),false);
  }
});

test('EX-17/19 transient retries are charged and lifetime-bounded across continuation',async t=>{
  const transient=async call=>{call.options.onResponse({status:503,headers:{}},call.model);return native({stopReason:'error'});};
  const {coordinator,fake,ledger}=await setup(t,{limits:{concurrency:1,maxRetries:1},actions:[transient,transient]});
  const first=value(await coordinator.submit(input(1,{maxRequests:1})));
  assert.equal(first.items[0].attempts,1);assert.equal(first.items[0].error.retryEligible,true);
  const denied=value(await coordinator.continue(resume(first,{maxRequests:0},['0'])));
  assert.equal(denied.items[0].status,'failed');assert.equal(denied.items[0].attempts,1);
  const done=value(await coordinator.continue(resume(first,{},['0'])));
  assert.equal(done.items[0].attempts,2);assert.equal(done.items[0].error.retryEligible,false);
  assert.equal(fake.calls.length,2);assert.equal(ledger.snapshot().totals.chargedRequests,2);
});

test('EX-17 automatic transient retry can complete within the same run',async t=>{
  const transient=async call=>{call.options.onResponse({status:429,headers:{}},call.model);return native({stopReason:'error'});};
  const {coordinator,fake}=await setup(t,{actions:[transient]});
  const page=value(await coordinator.submit(input(1,{})));assert.equal(page.counts.completed,1);
  assert.equal(page.items[0].attempts,2);assert.equal(fake.calls.length,2);
});

test('EX-20 disable drains uncooperative promises, keeps slots, pending work and charges',async t=>{
  const gate=deferred();const {coordinator,controls,fake,ledger}=await setup(t,{limits:{concurrency:1},actions:[()=>gate.promise]});
  let finished=false;const promise=coordinator.submit(input(2,{})).then(r=>{finished=true;return r;});
  await flush();assert.equal(fake.active,1);coordinator.disable();await flush();assert.equal(finished,false);
  assert.equal(coordinator.scheduler.active,1);assert.equal(fake.calls[0].aborted,true);
  gate.resolve(native({stopReason:'aborted',usage:undefined}));const page=value(await promise);
  assert.equal(page.stopReason,'disabled');assert.equal(page.counts.pending,1);assert.equal(page.counts.failed,1);
  assert.equal(ledger.snapshot().totals.chargedRequests,1);assert.equal(ledger.snapshot().totals.unknownAttempts,1);
  controls.enable();const done=value(await coordinator.continue(resume(page)));assert.equal(done.counts.failed,1);
  assert.equal(done.counts.completed,1);assert.equal(fake.calls.length,2);
});

test('EX-33 concurrent continuation and retrieval reject busy handles without duplicate work',async t=>{
  const gate=deferred();const {coordinator,fake}=await setup(t,{actions:[()=>gate.promise]});
  const prepared=value(await coordinator.submit(input(1)));const running=coordinator.continue(resume(prepared));
  await flush();assert.equal(coordinator.results({batchId:prepared.batchId}).data.error.code,'batch_busy');
  assert.equal((await coordinator.continue(resume(prepared))).data.error.code,'batch_busy');
  gate.resolve(native());value(await running);assert.equal(fake.calls.length,1);
});

test('EX-34 release expires handles and optional reuse references without restoring allowance',async t=>{
  const {coordinator,fake,ledger}=await setup(t);const page=value(await coordinator.submit(input(1,{})));
  coordinator.release(page.batchId);assert.equal(coordinator.results({batchId:page.batchId}).data.error.code,'batch_expired');
  value(await coordinator.submit(input(1,{})));assert.equal(fake.calls.length,2);assert.equal(ledger.snapshot().totals.chargedRequests,2);
});

test('EX-22 changing selected model blocks old batch dispatch without silently migrating it',async t=>{
  const {coordinator,controls,models,fake}=await setup(t);const prepared=value(await coordinator.submit(input(1)));
  models.push({...model,id:'other'});await coordinator.classifier.refresh();controls.select(models[1]);
  assert.equal((await coordinator.continue(resume(prepared))).data.error.code,'model_policy_mismatch');assert.equal(fake.calls.length,0);
  controls.select(model);assert.equal(value(await coordinator.continue(resume(prepared))).counts.completed,1);
});

test('EX-15 evidence/question/rubric/abstention policy identity changes are cache misses',async t=>{
  for(const mutate of [r=>r.items[0].state.index=99,r=>r.rubricVersion='v2',
    r=>r.questions.q.instructions='Changed fixture?',r=>r.questions.q.criteria.true='Affirmative',
    r=>r.abstainChoices={}]){
    const {coordinator,fake}=await setup(t);value(await coordinator.submit(input(1,{})));
    const raw=input(1,{});mutate(raw);
    const result=value(await coordinator.submit(raw));
    // An omitted and empty abstention policy have the same effective reuse identity.
    if(raw.abstainChoices)assert.equal(result.diagnostics.cacheHits,1);
    else assert.equal(fake.calls.length,2);
  }
  const {coordinator,fake}=await setup(t);const raw=input(1,{});
  raw.questions.q={type:'choice',instructions:'Pick',criteria:{yes:'yes',unknown:'unknown'}};
  value(await coordinator.submit(raw));raw.abstainChoices={q:['unknown']};
  value(await coordinator.submit(raw));assert.equal(fake.calls.length,2);
});

test('EX-15 identical in-flight misses are independent, failures are never reused',async t=>{
  const gate=deferred();const {coordinator,fake}=await setup(t,{actions:[()=>gate.promise,()=>gate.promise]});
  const a=coordinator.submit(input(1,{})),b=coordinator.submit(input(1,{}));await flush();
  assert.equal(fake.calls.length,2);gate.resolve(native({stopReason:'error'}));
  assert.equal(value(await a).counts.failed,1);assert.equal(value(await b).counts.failed,1);
  value(await coordinator.submit(input(1,{})));assert.equal(fake.calls.length,3);
});

test('EX-15 reuse requires current authorization and readable persistence even with zero new provider spend',async t=>{
  const {rmSync}=await import('node:fs');
  const {coordinator,controls,fake,session}=await setup(t);value(await coordinator.submit(input(1,{})));
  controls.disable();assert.equal((await coordinator.submit(input(1,{}))).data.error.code,'disabled');controls.enable();
  rmSync(session.getSessionFile());assert.equal((await coordinator.submit(input(1,{}))).data.error.code,'storage_error');
  assert.equal(fake.calls.length,1);
});

test('EX-19 explicit retry of a dispatched abort does not reopen any completed item',async t=>{
  const {coordinator,fake}=await setup(t,{actions:[async()=>native({stopReason:'aborted',usage:undefined})]});
  const first=value(await coordinator.submit(input(1,{})));assert.equal(first.items[0].error.retryEligible,true);
  const untouched=value(await coordinator.continue(resume(first)));assert.equal(untouched.items[0].attempts,1);
  const retry=value(await coordinator.continue(resume(first,{},['0'])));assert.equal(retry.items[0].attempts,2);
  assert.equal(retry.counts.completed,1);assert.equal(fake.calls.length,2);
});

test('EX-28 settlement failure returns available answer and usage but latches storage fault',async t=>{
  const {writeFileSync}=await import('node:fs');
  const f=await setup(t,{actions:[async()=>{writeFileSync(f.session.getSessionFile(),'{');return native();}]});
  const result=await f.coordinator.submit(input(1,{}));
  assert.equal(result.data.ok,false);assert.equal(result.data.error.code,'storage_error');
  assert.equal(result.data.batch.stopReason,'storage_error');assert.equal(result.data.batch.counts.completed,1);
  assert.equal(result.usageDelta.totalTokens,10);assert.equal(f.controls.enabled,false);
  assert.equal(f.ledger.snapshot().totals.chargedRequests,1);
});

test('EX-26 expiry waits for provider drain, denies stale calls immediately and clears workspaces afterward',async t=>{
  const gate=deferred();const {coordinator,fake}=await setup(t,{actions:[()=>gate.promise]});
  const running=coordinator.submit(input(1,{}));await flush();let expired=false;
  const expiry=coordinator.expire().then(()=>{expired=true;});await flush();assert.equal(expired,false);
  assert.equal((await coordinator.submit(input())).data.error.code,'runtime_expired');assert.equal(fake.active,1);
  gate.resolve(native({stopReason:'aborted'}));await running;await expiry;
  assert.equal(coordinator.workspaces.size,0);assert.equal(coordinator.scheduler.active,0);
});

test('EX-15 model configuration fingerprint and generation clearing both prevent reuse',async t=>{
  const f=await setup(t);value(await f.coordinator.submit(input(1,{})));
  f.models[0]={...model,baseUrl:'https://changed.invalid'};await f.coordinator.classifier.refresh();
  const changed=value(await f.coordinator.submit(input(1,{})));assert.equal(changed.diagnostics.cacheHits,0);
  f.coordinator.clear();const fresh=value(await f.coordinator.submit(input(1,{})));
  assert.equal(fresh.diagnostics.cacheHits,0);assert.equal(f.fake.calls.length,3);assert.equal(f.ledger.snapshot().totals.chargedRequests,3);
});

test('EX-16 oversized native answers fail charged and cannot seed reuse or automatic retry',async t=>{
  const f=await setup(t,{actions:[async()=>native({answers:{q:{type:'bool',probability:0.5,untrusted:'x'.repeat(70000)}}})]});
  const failed=value(await f.coordinator.submit(input(1,{})));
  assert.equal(failed.items[0].error.code,'invalid_response');assert.equal(failed.items[0].error.retryEligible,false);
  assert.equal(f.fake.calls.length,1);assert.equal(f.ledger.snapshot().totals.chargedRequests,1);
  const again=value(await f.coordinator.submit(input(1,{})));assert.equal(again.diagnostics.cacheHits,0);assert.equal(f.fake.calls.length,2);
});

test('EX-19 mixed valid and invalid retry selections reject atomically before reopening any failure',async t=>{
  const f=await setup(t,{limits:{concurrency:1},actions:[async()=>native({stopReason:'aborted',answers:{}})]});
  const page=value(await f.coordinator.submit(input(2,{}))),revision=f.coordinator.workspaces.get(page.batchId).revision;
  assert.equal(page.items[0].error.retryEligible,true);assert.equal(page.counts.completed,1);
  for(const ids of [['0','1'],['0','missing'],['0','0']]){
    assert.equal((await f.coordinator.continue(resume(page,{},ids))).data.ok,false);
    assert.equal(f.coordinator.workspaces.get(page.batchId).revision,revision);assert.equal(f.fake.calls.length,2);
    assert.equal(value(f.coordinator.results({batchId:page.batchId})).items[0].status,'failed');
  }
  const done=value(await f.coordinator.continue(resume(page,{},['0'])));assert.equal(done.counts.completed,2);
  assert.equal(f.fake.calls.length,3);assert.equal(f.ledger.snapshot().totals.chargedRequests,3);
});

test('EX-21 integrated queue deadline and running deadline retain slots until provider settlement',async t=>{
  const gate=deferred(),f=await setup(t,{limits:{concurrency:1,maxWorkMs:100,maxAttemptMs:100},actions:[()=>gate.promise]});
  const clock=new FakeClock(),coordinator=new Coordinator(f.controls,f.coordinator.classifier,{now:()=>clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
  const running=coordinator.submit(input(1,{maxWorkMs:50}));await flush();assert.equal(f.fake.active,1);
  const raw=input(1,{maxWorkMs:10});raw.items[0].state={different:true};const queued=coordinator.submit(raw);await flush();
  clock.advance(10);const waiting=value(await queued);assert.equal(waiting.stopReason,'deadline');assert.equal(waiting.counts.pending,1);
  assert.equal(f.fake.calls.length,1);assert.equal(f.ledger.snapshot().totals.chargedRequests,1);
  clock.advance(40);await flush();assert.equal(f.fake.calls[0].aborted,true);assert.equal(f.fake.active,1);
  gate.resolve(native({stopReason:'aborted',answers:{},usage:undefined}));const ended=value(await running);
  assert.equal(ended.stopReason,'deadline');assert.equal(ended.counts.failed,1);assert.equal(f.fake.active,0);
  assert.equal(ended.diagnostics.unknownUsageAttempts,1);assert.equal(f.fake.calls.length,1);
});

test('EX-22 selecting another model lets old attempt settle but blocks further old dispatch until restored',async t=>{
  const gate=deferred(),f=await setup(t,{limits:{concurrency:1},actions:[()=>gate.promise]});
  const running=f.coordinator.submit(input(2,{}));await flush();
  f.models.push({...model,id:'other'});await f.coordinator.classifier.refresh();f.controls.select(f.models[1]);
  gate.resolve(native());const page=value(await running);
  assert.equal(page.counts.completed,1);assert.equal(page.counts.pending,1);assert.equal(page.stopReason,'model_policy_mismatch');
  assert.equal(f.fake.calls.length,1);assert.equal((await f.coordinator.continue(resume(page))).data.error.code,'model_policy_mismatch');
  f.controls.select(model);const done=value(await f.coordinator.continue(resume(page)));
  assert.equal(done.counts.completed,2);assert.equal(f.fake.calls.length,2);assert.ok(f.fake.calls.every(c=>c.model.id==='fixture'));
});


test('internal charged-unit bridge counts its invocation only and leaves public envelopes unchanged',async t=>{
  const f=await setup(t,{limits:{concurrency:1}}),raw=input(2,{maxRequests:1});
  const bytes=jsonBytes({state:raw.items[0].state,questions:raw.questions});
  const prepared=await f.coordinator.submitManaged(input(1),'semantic');assert.deepEqual(prepared.charged,{requests:0,inputBytes:0});
  const first=await f.coordinator.submitManaged(raw,'semantic'),page=value(first);
  assert.deepEqual(first.charged,{requests:1,inputBytes:bytes});assert.equal(page.counts.pending,1);
  const second=await f.coordinator.continueManaged(resume(page,{maxRequests:1}),'semantic');
  assert.deepEqual(second.charged,{requests:1,inputBytes:bytes});assert.equal(value(second).counts.completed,2);
  first.charged.requests=999;assert.equal(f.ledger.snapshot().totals.chargedRequests,2);
  const reused=await f.coordinator.submitManaged(input(1,{}),'semantic');assert.deepEqual(reused.charged,{requests:0,inputBytes:0});
  assert.equal(value(reused).items[0].origin,'reuse');
  const publicResult=await f.coordinator.submit(input(1,{}));assert.deepEqual(Object.keys(publicResult),['data']);
  assert.equal('charged' in f.coordinator.results({batchId:page.batchId}),false);
});

test('internal bridge counts automatic retries and unknown native usage, not provider token totals',async t=>{
  const transient=async call=>{call.options.onResponse({status:503,headers:{}},call.model);return native({stopReason:'error',usage:undefined});};
  const f=await setup(t,{actions:[transient]}),raw=input(1,{}),result=await f.coordinator.submitManaged(raw,'semantic');
  const bytes=jsonBytes({state:raw.items[0].state,questions:raw.questions});
  assert.deepEqual(result.charged,{requests:2,inputBytes:bytes*2});assert.equal(value(result).diagnostics.unknownUsageAttempts,1);
  assert.equal(result.usageDelta.totalTokens,10);assert.equal(f.fake.calls.length,2);
});

test('internal bridge subtracts only verified nondispatch releases and reports storage uncertainty explicitly',async t=>{
  const f=await setup(t);f.controls.beforeDispatch=()=>{throw new ToolkitError('cancelled');};
  const released=await f.coordinator.submitManaged(input(1,{}),'semantic');
  assert.deepEqual(released.charged,{requests:0,inputBytes:0});assert.equal(f.fake.calls.length,0);assert.equal(f.ledger.snapshot().totals.chargedRequests,0);
  f.ledger.releaseUndispatched=()=>{throw new ToolkitError('storage_error');};
  const failedRelease=await f.coordinator.submitManaged(input(1,{}),'semantic');
  assert.equal(failedRelease.charged,null);assert.equal(failedRelease.data.error.code,'storage_error');assert.equal(f.ledger.snapshot().totals.chargedRequests,1);
  const g=await setup(t),reserve=g.ledger.reserve.bind(g.ledger);
  g.ledger.reserve=(...args)=>{reserve(...args);throw new ToolkitError('storage_error');};
  const uncertain=await g.coordinator.submitManaged(input(1,{}),'semantic');
  assert.equal(uncertain.charged,null);assert.equal(g.fake.calls.length,0);assert.equal(g.ledger.snapshot().totals.chargedRequests,1);
});

test('internal invocation counters exclude concurrent generic spending and preserve charged failure usage',async t=>{
  const gate=deferred(),f=await setup(t,{limits:{concurrency:2},actions:[()=>gate.promise,async()=>native()]});
  const semantic=f.coordinator.submitManaged(input(1,{}),'semantic');await flush();
  const raw=input(1,{});raw.items[0].state={different:'generic'};await f.coordinator.submit(raw);
  gate.resolve(native({stopReason:'error',usage:undefined}));const result=await semantic;
  assert.equal(result.charged.requests,1);assert.equal(f.ledger.snapshot().totals.chargedRequests,2);
  assert.equal(value(result).counts.failed,1);assert.equal(result.usageDelta,undefined);
  const {writeFileSync}=await import('node:fs');
  const g=await setup(t,{actions:[async()=>{writeFileSync(g.session.getSessionFile(),'{');return native();}]});
  const failure=await g.coordinator.submitManaged(input(1,{}),'semantic');assert.equal(failure.charged,null);
  assert.equal(failure.data.error.code,'storage_error');assert.equal(failure.data.batch.counts.completed,1);assert.equal(failure.usageDelta.totalTokens,10);
});


test('internal batch identity survives failed public page projection for owned cleanup',async t=>{
  const f=await setup(t);f.coordinator.pages.page=()=>{throw new ToolkitError('output_limit');};
  const result=await f.coordinator.submitManaged(input(1),'semantic');
  assert.equal(result.data.error.code,'output_limit');assert.equal(typeof result.batchId,'string');
  assert.equal(f.coordinator.workspaces.get(result.batchId).outcomes[0].status,'pending');
  f.coordinator.release(result.batchId);assert.equal(f.coordinator.workspaces.size,0);
});


test('failed page projection cannot disguise uncertain reservation accounting as zero',async t=>{
  const f=await setup(t),reserve=f.ledger.reserve.bind(f.ledger);
  f.ledger.reserve=(...args)=>{reserve(...args);throw new ToolkitError('storage_error');};
  f.coordinator.pages.page=()=>{throw new ToolkitError('output_limit');};
  const result=await f.coordinator.submitManaged(input(1,{}),'semantic');
  assert.equal(result.data.error.code,'output_limit');assert.equal(result.charged,null);
  assert.equal(f.ledger.snapshot().totals.chargedRequests,1);assert.equal(f.fake.calls.length,0);
});
