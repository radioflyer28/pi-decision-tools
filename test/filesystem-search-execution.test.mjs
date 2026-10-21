import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {searchFixture} from './helpers/search.mjs';
import {fakeUsage,FakeClock,deferred} from './helpers/fixtures.mjs';
import {QUESTIONS} from '../dist/semantic/preparation.js';
import {jsonBytes} from '../dist/core/validation.js';
const native=(extra={})=>({api:'fake',provider:'fake',model:'fixture',stopReason:'stop',timestamp:0,usage:fakeUsage(),answers:{relevance:{type:'choice',choice:'match',probabilities:{match:1,no_match:0,insufficient_context:0},confidence:1}},...extra});
const resume=(p,run={},ids)=>({operationId:p.operationId,expectedIdentity:p.identity,run,...(ids?{retryFailedEvidenceIds:ids}:{})});
for(const mode of ['systematic','discovery']) {
const test=(name,fn)=>nodeTest(`${mode}: ${name}`,fn);
const settings=mode==='discovery'?{mode,targetMatches:100}:{mode},all=mode==='discovery'?{view:'all'}:{};
async function prepared(t,options={},n=10){
  const h=await searchFixture(t,{...options,limits:{concurrency:1,...options.limits}}),path=join(h.f.root,'source.txt'),text='z\n'.repeat(64+56*(n-1));
  writeFileSync(path,text);const start=await h.engine.search({...settings,predicate:'Does a cancellation guard exist?',scope:{paths:['source.txt']}});
  return {...h,path,text,page:h.results.page({...start,...all}).value};
}

test('ten windows use one eight-request cap and retained continuation after source deletion',async t=>{
  let reads=0;const h=await prepared(t,{hooks:{beforeOpen:async()=>{reads++;}}});
  const first=await h.engine.continue(resume(h.page,{maxRequests:8})),p=h.results.page({...all,operationId:first.operationId}).value;
  assert.deepEqual(p.coverage.initial,{total:10,judged:8,failed:0,pending:2,running:0});assert.equal(p.stopReason,'call_limit');assert.equal(first.usageDelta.totalTokens,80);
  const capturedReads=reads;writeFileSync(h.path,'replacement must not be classified');await h.engine.continue(resume(p,{maxRequests:1}));
  unlinkSync(h.path);await h.engine.continue(resume(p,{maxRequests:1}));const done=h.results.page({...all,operationId:first.operationId}).value;
  assert.equal(done.complete,true);assert.equal(done.usage[0].usage.totalTokens,100);assert.equal(done.diagnostics.attempts,10);assert.equal(reads,capturedReads);
  assert.equal(h.fake.calls.length,10);assert.equal(h.ledger.snapshot().totals.chargedRequests,10);
  assert.deepEqual(h.fake.calls.map(c=>c.request.state.evidence.source.startLine),Array.from({length:10},(_,i)=>1+56*i));
  for(const c of h.fake.calls){assert.deepEqual(c.request.questions,QUESTIONS);assert.equal(c.request.state.predicate,'Does a cancellation guard exist?');assert.equal(c.request.state.evidence.text,'z\n'.repeat(64));assert.equal(c.request.state.evidence.source.kind,'file');assert.equal(c.request.state.evidence.source.path,'source.txt');}
  const revision=done.revision;await assert.rejects(h.engine.continue({...resume(done),expectedIdentity:'f'.repeat(64)}),{code:'identity_mismatch'});
  assert.equal(h.results.page({...all,operationId:first.operationId}).value.revision,revision);
});

test('search retries stay live across settled child retirement and have atomic lifetime ceilings',async t=>{
  const aborted=async()=>native({stopReason:'aborted',usage:undefined});
  const h=await prepared(t,{actions:[aborted]});await h.engine.continue(resume(h.page));let p=h.results.page({...all,operationId:h.page.operationId}).value;
  assert.equal(p.complete,true);assert.equal(p.coverage.initial.failed,1);assert.equal(p.continuation.canResume,true);assert.equal(p.diagnostics.unknownUsageAttempts,1);
  const failed=p.items[0].evidence.evidenceId,success=p.items[1].evidence.evidenceId,revision=p.revision;
  for(const ids of [[failed,success],[failed,'unknown'],[failed,failed]]){await assert.rejects(h.engine.continue(resume(p,{},ids)));assert.equal(h.results.page({...all,operationId:p.operationId}).value.revision,revision);assert.equal(h.fake.calls.length,10);}
  h.fake.actions.push(aborted);await h.engine.continue(resume(p,{},[failed]));p=h.results.page({...all,operationId:p.operationId}).value;
  assert.equal(p.items[0].attempts,2);assert.equal(p.items[0].error.retryEligible,false);assert.equal(p.continuation.canResume,false);
  assert.equal(p.diagnostics.attempts,11);assert.equal(p.diagnostics.unknownUsageAttempts,2);assert.equal(p.usage[0].usage.totalTokens,90);
  await assert.rejects(h.engine.continue(resume(p,{},[failed])),{code:'invalid_retry_selection'});assert.equal(h.fake.calls.length,11);
  h.engine.parents.release(p.operationId);assert.equal(h.ledger.snapshot().totals.chargedRequests,11);assert.equal(h.core.memory.retainedBytes,0);assert.equal(h.core.memory.reservedBytes,0);
});

test('search input-byte units decrease across child boundaries',async t=>{
  const h=await prepared(t);const costs=Array.from({length:9},(_,i)=>jsonBytes({state:{predicate:'Does a cancellation guard exist?',evidence:{text:'z\n'.repeat(64),source:{kind:'file',path:'source.txt',startLine:1+56*i,endLine:64+56*i}}},questions:QUESTIONS}));
  const ceiling=costs.reduce((a,b)=>a+b,0);await h.engine.continue(resume(h.page,{maxInputBytes:ceiling}));
  const p=h.results.page({...all,operationId:h.page.operationId}).value;assert.equal(p.coverage.initial.judged,9);assert.equal(p.coverage.initial.pending,1);
  assert.equal(h.fake.calls.length,9);assert.equal(h.ledger.snapshot().totals.chargedInputBytes,ceiling);
});

test('capture elapsed time and later children share one monotonic deadline',async t=>{
  const timer=new FakeClock(),clock={now:()=>timer.now,setTimeout:timer.setTimeout,clearTimeout:timer.clearTimeout};
  const h=await searchFixture(t,{clock,limits:{concurrency:1,maxWorkMs:20,maxAttemptMs:20},hooks:{afterRead:async()=>{timer.advance(2);}},actions:Array.from({length:10},()=>async()=>{timer.advance(1);return native();})});
  writeFileSync(join(h.f.root,'a.txt'),'z\n'.repeat(64+56*9));const result=await h.engine.search({...settings,predicate:'Fixture?',scope:{paths:['a.txt']},run:{maxWorkMs:11}});
  const p=h.results.page({...all,operationId:result.operationId}).value;assert.equal(h.fake.calls.length,9);assert.equal(p.stopReason,'deadline');assert.equal(p.coverage.initial.pending,1);assert.equal(timer.timers.size,0);
});

test('search model fingerprint changes stop the next child without fallback',async t=>{
  const h=await prepared(t);h.models.push({...h.models[0],id:'other'});await h.classifier.refresh();
  h.fake.actions.push(...Array.from({length:7},()=>async()=>native()),async()=>{h.controls.select(h.models[1]);return native();});
  const result=await h.engine.continue(resume(h.page));assert.equal(result.error,'model_policy_mismatch');assert.equal(h.fake.calls.length,8);
  const p=h.results.page({...all,operationId:h.page.operationId}).value;assert.equal(p.coverage.initial.pending,2);assert.equal(p.model.id,'fixture');
});

test('search and generic invocations share allowance and scheduler but not local request ceilings',async t=>{
  const gate=deferred(),entered=deferred(),h=await prepared(t,{limits:{concurrency:2},actions:[()=>{entered.resolve();return gate.promise;}]});
  const running=h.engine.continue(resume(h.page,{maxRequests:9}));await entered.promise;
  try{const generic=await h.core.submit({items:[{id:'g',inputVersion:'1',state:{synthetic:true}}],rubricVersion:'fixture',questions:{q:{type:'bool',instructions:'Fixture?',criteria:{true:'yes',false:'no'}}},run:{maxRequests:1}});assert.equal(generic.data.ok,true);}
  finally{gate.resolve(native());await running;}
  assert.equal(h.results.page({...all,operationId:h.page.operationId}).value.coverage.initial.judged,9);assert.equal(h.fake.calls.length,10);assert.ok(h.fake.peak<=2);assert.equal(h.ledger.snapshot().totals.chargedRequests,10);
});

}
