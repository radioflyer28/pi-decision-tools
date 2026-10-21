import test from 'node:test';
import assert from 'node:assert/strict';
import { RetainedMemory } from '../dist/core/memory.js';
import { Workspaces } from '../dist/core/workspaces.js';
import { BOUNDS } from '../dist/core/validation.js';
const model={provider:'fake',id:'fake',api:'fake',configurationFingerprint:'f',backendVersionKnown:false};
const input={items:[{id:'a',inputVersion:'v',state:{text:'test'}}],rubricVersion:'v',questions:{q:{type:'bool',instructions:'Fixture?',criteria:{true:'yes',false:'no'}}}};

test('one retained/reserved ceiling admits exact boundary and rolls back rejected resize',()=>{
  const pool=new RetainedMemory(),a=pool.allocate(100,200),b=pool.allocate(BOUNDS.workspaceBytes-300);
  assert.equal(pool.availableBytes,0);assert.throws(()=>pool.allocate(1),{code:'workspace_full'});
  assert.throws(()=>pool.resize(a,101,200),{code:'workspace_full'});
  assert.equal(pool.retainedBytes,BOUNDS.workspaceBytes-200);assert.equal(pool.reservedBytes,200);
  pool.release(b);pool.resize(a,50,100);assert.equal(pool.retainedBytes,50);assert.equal(pool.reservedBytes,100);
  pool.release(a);pool.release(a);assert.equal(pool.availableBytes,BOUNDS.workspaceBytes);
});

test('growth transfers conservatively, rejecting foreign/stale/invalid tokens without leaking or double release',()=>{
  const pool=new RetainedMemory(),owner=pool.allocate(20),growth=pool.allocate(0,100),foreign=new RetainedMemory().allocate(1);
  for(const value of [-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>pool.resize(owner,value,0),{code:'invalid_memory_allocation'});
  for(const call of [()=>pool.commitGrowth(growth,foreign,20),()=>pool.commitGrowth(owner,owner,0),()=>pool.commitGrowth(growth,owner,101)])assert.throws(call,{code:'invalid_memory_allocation'});
  assert.equal(pool.retainedBytes,20);assert.equal(pool.reservedBytes,100);
  pool.commitGrowth(growth,owner,30);assert.equal(pool.retainedBytes,50);assert.equal(pool.reservedBytes,0);
  pool.release(growth);pool.release(foreign);assert.equal(pool.retainedBytes,50);
  assert.throws(()=>pool.resize(growth,1,0),{code:'invalid_memory_allocation'});
  pool.release(owner);assert.equal(pool.availableBytes,BOUNDS.workspaceBytes);
});

test('generic workspaces and parent allocations compete without eviction; clearing one owner preserves the others',()=>{
  const pool=new RetainedMemory(),generic=new Workspaces(pool),child=new Workspaces(pool);
  const a=generic.prepare(input,model),b=child.prepare(input,model);
  const parent=pool.allocate(pool.availableBytes);
  assert.throws(()=>generic.prepare(input,model),{code:'workspace_full'});
  assert.equal(generic.get(a.id).id,a.id);assert.equal(child.get(b.id).id,b.id);
  generic.clear();assert.equal(child.size,1);assert.equal(pool.retainedBytes,BOUNDS.workspaceBytes-a.inputBytes);
  pool.release(parent);child.acquire(b.id);const growth=child.reserveAnswer(b.id);
  child.completeAnswer(growth,0,{q:{type:'bool',probability:0.5}});child.discardAnswer(growth);
  assert.equal(pool.reservedBytes,0);child.finish(b.id);child.clear();assert.equal(pool.retainedBytes,0);
});
