import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {searchFixture} from './helpers/search.mjs';
import {deferred,FakeClock} from './helpers/fixtures.mjs';
for(const mode of ['systematic','discovery']) {
const test=(name,fn)=>nodeTest(`${mode}: ${name}`,fn);
const input={mode,predicate:'Fixture?',scope:{paths:['a.txt']}};

test('pre-aborted search does not acquire root metadata or owned storage',async t=>{
  let metadata=0;const h=await searchFixture(t,{hooks:{attributes:async()=>{metadata++;}}});writeFileSync(join(h.f.root,'a.txt'),'synthetic');
  const abort=new AbortController();abort.abort('deadline');
  await assert.rejects(h.engine.search(input,{signal:abort.signal}),{code:'cancelled'});
  assert.equal(metadata,0);assert.equal(h.engine.parents.size,0);assert.equal(h.core.memory.retainedBytes,0);assert.equal(h.core.memory.reservedBytes,0);
});

test('deadline during root acquisition stays a deadline and leaves no late parent',async t=>{
  const timer=new FakeClock(),clock={now:()=>timer.now,setTimeout:timer.setTimeout,clearTimeout:timer.clearTimeout};
  const h=await searchFixture(t,{clock,hooks:{attributes:async()=>{timer.advance(2);}}});writeFileSync(join(h.f.root,'a.txt'),'synthetic');
  await assert.rejects(h.engine.search({...input,run:{maxWorkMs:1}}),{code:'deadline'});
  assert.equal(h.engine.parents.size,0);assert.equal(h.core.memory.retainedBytes,0);assert.equal(h.core.memory.reservedBytes,0);assert.equal(timer.timers.size,0);assert.equal(h.fake.calls.length,0);
});

test('eight pending captures count toward shared parent admission and disable drains them all',async t=>{
  let entered=0;const ready=deferred(),finish=deferred(),h=await searchFixture(t,{hooks:{beforeOpen:async()=>{if(++entered===8)ready.resolve();await finish.promise;}}});
  writeFileSync(join(h.f.root,'a.txt'),'synthetic');const pending=Promise.allSettled(Array.from({length:8},()=>h.engine.search(input)));let drained=false,drain;
  try{
    await ready.promise;await assert.rejects(h.engine.search(input),{code:'workspace_full'});
    await assert.rejects(h.engine.filter({predicate:'Fixture?',records:[{id:'r',text:'record'}]}),{code:'workspace_full'});
    assert.equal(entered,8);h.engine.pause();drain=h.engine.drain().then(()=>{drained=true;});
    await new Promise(resolve=>setImmediate(resolve));assert.equal(drained,false);
  }finally{finish.resolve();const outcomes=await pending;await drain;assert.ok(outcomes.every(r=>r.status==='rejected'&&r.reason.code==='disabled'));}
  assert.equal(h.engine.parents.size,0);assert.equal(h.fake.calls.length,0);assert.equal(h.core.memory.retainedBytes,0);assert.equal(h.core.memory.reservedBytes,0);
});

test('expiry during capture rejects late attachment and drains before releasing memory',async t=>{
  const entered=deferred(),finish=deferred(),h=await searchFixture(t,{hooks:{beforeOpen:async()=>{entered.resolve();await finish.promise;}}});writeFileSync(join(h.f.root,'a.txt'),'synthetic');
  const running=h.engine.search(input).then(value=>({value}),error=>({error}));await entered.promise;let ended=false;
  const ending=h.engine.expire().then(()=>{ended=true;});
  try{await new Promise(resolve=>setImmediate(resolve));assert.equal(ended,false);}
  finally{finish.resolve();await ending;}
  assert.equal((await running).error.code,'runtime_expired');assert.equal(h.engine.parents.size,0);assert.equal(h.core.memory.retainedBytes,0);assert.equal(h.core.memory.reservedBytes,0);assert.equal(h.fake.calls.length,0);
});

test('caller cancellation drains an abort-ignoring dispatched search and retains unknown liability',async t=>{
  const entered=deferred(),finish=deferred(),h=await searchFixture(t,{limits:{concurrency:1},actions:[()=>{entered.resolve();return finish.promise;}]});writeFileSync(join(h.f.root,'a.txt'),'z\n'.repeat(120));
  const abort=new AbortController();let ended=false;const running=h.engine.search({...input,run:{}},{signal:abort.signal}).then(value=>{ended=true;return value;});await entered.promise;
  try{abort.abort();await new Promise(resolve=>setImmediate(resolve));assert.equal(ended,false);assert.equal(h.core.scheduler.active,1);}
  finally{finish.resolve({api:'fake',provider:'fake',model:'fixture',stopReason:'aborted',answers:{},timestamp:0});}
  const result=await running,p=h.results.page({operationId:result.operationId}).value;
  assert.equal(p.stopReason,'cancelled');assert.equal(p.coverage.initial.pending,1);assert.equal(p.diagnostics.unknownUsageAttempts,1);assert.equal(h.fake.calls.length,1);
  h.engine.parents.release(result.operationId);assert.equal(h.ledger.snapshot().totals.chargedRequests,1);assert.equal(h.core.memory.retainedBytes,0);assert.equal(h.core.memory.reservedBytes,0);
});

}
