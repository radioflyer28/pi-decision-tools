import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {searchFixture} from './helpers/search.mjs';
const generic=(id,run)=>({items:[{id,inputVersion:'1',state:{synthetic:id}}],rubricVersion:'fixture',questions:{q:{type:'bool',instructions:'Fixture?',criteria:{true:'yes',false:'no'}}},...(run?{run}:{})});
const memory=h=>({retained:h.core.memory.retainedBytes,reserved:h.core.memory.reservedBytes});
const size=m=>m.retained+m.reserved;

for(const mode of ['systematic','discovery']) {
const test=(name,fn)=>nodeTest(`${mode}: ${name}`,fn);
test('search parent rollback and partial capture share actual generic/record memory and preserve liability',async t=>{
  let reads=0;const h=await searchFixture(t,{hooks:{beforeOpen:async()=>{reads++;}}});writeFileSync(join(h.f.root,'a.txt'),'hello');writeFileSync(join(h.f.root,'b.txt'),'z'.repeat(200000));
  const g=await h.core.submit(generic('g',{}));assert.equal(g.data.ok,true);
  const r=await h.engine.filter({predicate:'Fixture?',records:[{id:'r',text:'retained record'}]}),before=memory(h),ledger=h.ledger.snapshot();
  const input={mode,predicate:'Fixture?',scope:{paths:['a.txt']}};
  const measured=await h.engine.search(input),needed=size(memory(h))-size(before);h.engine.parents.release(measured.operationId);assert.deepEqual(memory(h),before);
  let pressure=h.core.memory.allocate(h.core.memory.availableBytes-needed+1),baseline=memory(h),beforeReads=reads;
  try{await assert.rejects(h.engine.search(input),{code:'workspace_full'});assert.equal(reads,beforeReads+1);assert.deepEqual(memory(h),baseline);assert.equal(h.engine.parents.size,1);}
  finally{h.core.memory.release(pressure);}
  pressure=h.core.memory.allocate(h.core.memory.availableBytes-20000);
  let partial;
  try{partial=await h.engine.search({...input,scope:{paths:['a.txt','b.txt']}});const p=h.results.page(partial).value;
    assert.equal(p.stopReason,'workspace_full');assert.equal(p.complete,false);assert.equal(p.coverage.initial.pending,1);assert.equal(p.coverage.enumeration.remainingCandidates,null);
  }finally{h.core.memory.release(pressure);}
  assert.deepEqual(h.ledger.snapshot(),ledger);assert.equal(h.core.results({batchId:g.data.value.batchId}).data.ok,true);assert.equal(h.results.page(r).ok,true);
  const p=h.results.page(partial).value,capturedReads=reads;await h.engine.continue({operationId:p.operationId,expectedIdentity:p.identity,run:{}});
  const done=h.results.page(partial).value;assert.equal(done.coverage.initial.judged,1);assert.equal(done.complete,false);assert.equal(done.stopReason,'workspace_full');assert.equal(done.continuation.canResume,false);assert.equal(reads,capturedReads);
  h.engine.parents.release(p.operationId);assert.deepEqual(memory(h),before);assert.equal(h.ledger.snapshot().totals.chargedRequests,2);
  h.engine.parents.release(r.operationId);h.core.release(g.data.value.batchId);assert.deepEqual(memory(h),{retained:0,reserved:0});assert.equal(h.ledger.snapshot().totals.chargedRequests,2);
});

test('32 unrelated live batches cause explicit child contention without eviction or a permanent search cap',async t=>{
  const h=await searchFixture(t);writeFileSync(join(h.f.root,'a.txt'),'hello');const ids=[];
  for(let i=0;i<32;i++){const g=await h.core.submit(generic(String(i),i===0?{}:undefined));assert.equal(g.data.ok,true);ids.push(g.data.value.batchId);}
  const before=memory(h),{operationId}=await h.engine.search({mode,predicate:'Fixture?',scope:{paths:['a.txt']}}),p=h.results.page({operationId}).value;
  const blocked=await h.engine.continue({operationId,expectedIdentity:p.identity,run:{}});assert.equal(blocked.error,'workspace_full');assert.equal(h.results.page({operationId}).value.coverage.initial.pending,1);
  for(const batchId of ids)assert.equal(h.core.results({batchId}).data.ok,true);
  const full=memory(h);h.core.release(ids.pop());const freed={retained:full.retained-memory(h).retained,reserved:full.reserved-memory(h).reserved};
  const done=await h.engine.continue({operationId,expectedIdentity:p.identity,run:{}});assert.equal(done.error,undefined);assert.equal(h.results.page({operationId}).value.complete,true);
  h.engine.parents.release(operationId);assert.deepEqual(memory(h),{retained:before.retained-freed.retained,reserved:before.reserved-freed.reserved});
  assert.equal(h.fake.calls.length,2);assert.equal(h.ledger.snapshot().totals.chargedRequests,2);
});

}
