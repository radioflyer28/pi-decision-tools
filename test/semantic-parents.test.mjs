import test from 'node:test';
import assert from 'node:assert/strict';
import { SemanticParents, parentGrowthBytes } from '../dist/semantic/parents.js';
import { prepareFilter } from '../dist/semantic/preparation.js';
import { RetainedMemory } from '../dist/core/memory.js';
import { Workspaces } from '../dist/core/workspaces.js';
import { jsonBytes, BOUNDS } from '../dist/core/validation.js';
const model={provider:'fake',id:'fixture',api:'fake',configurationFingerprint:'f',backendVersionKnown:false};
const prepared=(n=1,text='test')=>prepareFilter({predicate:'Supported?',records:Array.from({length:n},(_,i)=>({id:String(i),text}))},model);
function setup(){
  const memory=new RetainedMemory(),workspaces=new Workspaces(memory),core={memory,workspaces,
    async submitManaged(input,consumer,options,pin){assert.equal(consumer,'semantic');assert.deepEqual(pin,model);
      try{const batch=workspaces.prepare(input,pin);return {data:{ok:true,value:{batchId:batch.id,identity:batch.identity}},charged:{requests:0,inputBytes:0}};}
      catch(error){return {data:{ok:false,error:{code:error.code,message:error.code}},charged:{requests:0,inputBytes:0}};}},
    release(id){workspaces.release(id);}};
  return {memory,workspaces,parents:new SemanticParents(core)};
}
function complete(workspaces,child){
  const batch=workspaces.acquire(child.batchId);
  for(let i=0;i<child.count;i++){
    batch.outcomes[i].attempts=1;
    workspaces.completeAnswer(workspaces.reserveAnswer(batch.id),i,{relevance:{type:'choice',choice:'match',probabilities:{match:0.9,no_match:0.1,insufficient_context:0},confidence:0.9}});
  }
  workspaces.finish(batch.id);
}

test('eight parents share one pool and rejected admission preserves all handles',()=>{
  const {parents,memory}=setup(),all=Array.from({length:8},()=>parents.admit(prepared()));
  const before=memory.availableBytes;assert.throws(()=>parents.admit(prepared()),{code:'workspace_full'});assert.equal(memory.availableBytes,before);
  for(const p of all)assert.equal(parents.get(p.id).id,p.id);
  parents.release(all[0].id);assert.throws(()=>parents.get(all[0].id),{code:'search_expired'});parents.admit(prepared());
  parents.clear();assert.equal(memory.availableBytes,BOUNDS.workspaceBytes);
});

test('maximum count and near-maximum total input reserve bounded growth, not generic answer caps',()=>{
  const {parents,memory}=setup();
  const raw={predicate:'Supported?',records:Array.from({length:128},(_,i)=>({id:String(i),text:'x'.repeat(8000)}))};
  let room=BOUNDS.submitBytes-jsonBytes(raw);
  for(const record of raw.records){const extra=Math.min(room,16384-record.text.length);record.text+='x'.repeat(extra);room-=extra;}
  assert.equal(jsonBytes(raw),BOUNDS.submitBytes);
  const p=prepareFilter(raw,model),data=parents.admit(p);
  assert.equal(data.outcomes.length,128);assert.equal(memory.retainedBytes,jsonBytes(data,Number.MAX_SAFE_INTEGER));
  assert.equal(memory.reservedBytes,parentGrowthBytes(p));assert.ok(memory.retainedBytes+memory.reservedBytes<2*1048576);
  const available=memory.availableBytes;const other=memory.allocate(available);
  assert.throws(()=>parents.admit(prepared()),{code:'workspace_full'});assert.equal(parents.size,1);
  parents.clear();assert.equal(memory.retainedBytes,available);memory.release(other);assert.equal(memory.availableBytes,BOUNDS.workspaceBytes);
});

test('owned children retain attempts and copied answers; release cannot free unrelated generic work',async()=>{
  const {parents,workspaces,memory}=setup(),p=parents.admit(prepared(10));parents.acquire(p.id);
  const child=await parents.prepareChild(p.id);assert.equal(child.count,8);
  await assert.rejects(()=>parents.prepareChild(p.id),{code:'search_busy'});assert.equal(workspaces.size,1);
  complete(workspaces,child);const before=memory.retainedBytes;parents.capture(p.id);assert.ok(memory.retainedBytes>before);
  assert.equal(parents.get(p.id).outcomes.filter(o=>o.status==='completed').length,8);
  const second=await parents.prepareChild(p.id);assert.equal(second.count,2);assert.equal(second.start,8);
  assert.equal(parents.get(p.id).outcomes[0].attempts,1);
  parents.get(p.id).outcomes[0].answers.relevance.probabilities.match=0.1;
  assert.equal(workspaces.get(child.batchId).outcomes[0].answers.relevance.probabilities.match,0.9);
  assert.throws(()=>parents.release(p.id),{code:'search_busy'});parents.finish(p.id);
  const unrelated=parents.admit(prepared());const bytes=jsonBytes(unrelated,Number.MAX_SAFE_INTEGER);
  parents.release(p.id);assert.equal(workspaces.size,0);assert.equal(memory.retainedBytes,bytes);
  assert.throws(()=>parents.get(p.id),{code:'search_expired'});parents.clear();assert.equal(memory.availableBytes,BOUNDS.workspaceBytes);
});

test('shared 32 batch limit reports workspace_full while preserving successful child and retry state',async()=>{
  const {parents,workspaces}=setup(),p=parents.admit(prepared(10));parents.acquire(p.id);
  const first=await parents.prepareChild(p.id);complete(workspaces,first);parents.capture(p.id);
  const raw=workspaces.get(first.batchId).input,unrelated=[];
  for(let i=0;i<31;i++)unrelated.push(workspaces.prepare(raw,model).id);
  await assert.rejects(()=>parents.prepareChild(p.id),{code:'workspace_full'});
  assert.equal(parents.get(p.id).stopReason,'workspace_full');assert.equal(parents.get(p.id).children.length,1);
  assert.equal(parents.get(p.id).outcomes[0].attempts,1);assert.equal(parents.get(p.id).outcomes[8].status,'pending');
  workspaces.release(unrelated.pop());const second=await parents.prepareChild(p.id);assert.equal(second.start,8);
  parents.finish(p.id);parents.release(p.id);assert.equal(workspaces.size,30);
  for(const id of unrelated)workspaces.release(id);
});

test('parent state growth is measured atomically and busy clear does not release any owner',()=>{
  const {parents,memory}=setup(),p=parents.admit(prepared()),other=parents.admit(prepared());
  const before=memory.availableBytes,old=parents.get(p.id);
  assert.throws(()=>parents.update(p.id,{usage:[{provider:'x'.repeat(100000),model:'x',usage:null,pricing:'unknown'}]}),{code:'workspace_full'});
  assert.equal(parents.get(p.id),old);assert.equal(memory.availableBytes,before);
  parents.acquire(other.id);assert.throws(()=>parents.clear(),{code:'search_busy'});assert.equal(parents.size,2);
  parents.finish(other.id);parents.clear();assert.equal(memory.availableBytes,BOUNDS.workspaceBytes);
});


test('failed child result projection releases an admitted but not yet owned batch',async()=>{
  const {parents,workspaces,memory}=setup(),p=parents.admit(prepared());parents.acquire(p.id);
  const original=parents.core.submitManaged.bind(parents.core);
  parents.core.submitManaged=async(...args)=>{const result=await original(...args);return {data:{ok:false,error:{code:'output_limit',message:'output_limit'}},batchId:result.data.value.batchId,charged:{requests:0,inputBytes:0}};};
  const before=memory.availableBytes;
  await assert.rejects(()=>parents.prepareChild(p.id),{code:'output_limit'});
  assert.equal(workspaces.size,0);assert.equal(parents.get(p.id).children.length,0);assert.equal(memory.availableBytes,before);
  parents.finish(p.id);parents.release(p.id);assert.equal(memory.availableBytes,BOUNDS.workspaceBytes);
});
