import test from 'node:test';
import assert from 'node:assert/strict';
import { Workspaces } from '../dist/core/workspaces.js';
import { pinModel } from '../dist/core/controls.js';
import { BOUNDS, jsonBytes } from '../dist/core/validation.js';
const model=pinModel({provider:'fake',id:'fixture',api:'fake'});
const input=()=>({items:[{id:'a',inputVersion:'1',state:{text:'synthetic'}}],rubricVersion:'v1',
  questions:{q:{type:'bool',instructions:'Fixture?',criteria:{true:'yes',false:'no'}}}});
const answer={q:{type:'bool',probability:0.7}};

test('EX-10/14 admission copies input/model and excludes run ceilings from immutable identity',()=>{
  const store=new Workspaces(),raw=input(),pin={...model};
  const a=store.prepare(raw,pin),b=store.prepare({...raw,run:{maxRequests:0}},model);
  assert.equal(a.identity,b.identity);raw.items[0].state.text='changed';pin.id='changed';
  assert.equal(a.input.items[0].state.text,'synthetic');assert.equal(a.model.id,'fixture');
  assert.notEqual(a.identity,store.prepare(raw,model).identity);
  assert.equal(a.outcomes[0].status,'pending');assert.equal(a.stopReason,'prepared');
});

test('EX-34 batch count rejection is atomic and never silently evicts a live handle',()=>{
  const store=new Workspaces(),ids=[];for(let i=0;i<32;i++)ids.push(store.prepare(input(),model).id);
  const bytes=store.retainedBytes;
  assert.throws(()=>store.prepare(input(),model),{code:'workspace_full'});
  assert.equal(store.size,32);assert.equal(store.retainedBytes,bytes);
  for(const id of ids)assert.equal(store.get(id).id,id);
  store.release(ids[0]);assert.throws(()=>store.get(ids[0]),{code:'batch_expired'});
  store.prepare(input(),model);assert.equal(store.size,32);
});

test('EX-34 input memory bound rejects atomically without affecting previous batches',()=>{
  const store=new Workspaces(),raw=input();raw.items=Array.from({length:12},(_,i)=>({id:String(i),inputVersion:'1',state:{text:'x'.repeat(60000)}}));
  while(store.retainedBytes+jsonBytes(raw)<=BOUNDS.workspaceBytes)store.prepare(raw,model);
  const before=store.retainedBytes,count=store.size;
  assert.throws(()=>store.prepare(raw,model),{code:'workspace_full'});
  assert.equal(store.retainedBytes,before);assert.equal(store.size,count);
});

test('EX-34 active attempts reserve worst-case answer growth before dispatch',()=>{
  const store=new Workspaces(),batch=store.prepare(input(),model);store.acquire(batch.id);
  const tokens=[];while(store.retainedBytes+store.reservedBytes+BOUNDS.answerBytes<=BOUNDS.workspaceBytes)
    tokens.push(store.reserveAnswer(batch.id));
  assert.throws(()=>store.reserveAnswer(batch.id),{code:'workspace_full'});
  assert.throws(()=>store.prepare({...input(),items:[{id:'a',inputVersion:'1',state:{text:'x'.repeat(65000)}},{id:'b',inputVersion:'1',state:{text:'x'.repeat(1000)}}]},model),{code:'workspace_full'});
  const token=tokens.shift();store.completeAnswer(token,0,answer);
  assert.equal(batch.outcomes[0].status,'completed');assert.equal(batch.answerBytes,jsonBytes(answer));
  for(const remaining of tokens)store.discardAnswer(remaining);
  assert.equal(store.reservedBytes,0);
  store.finish(batch.id);store.release(batch.id);assert.equal(store.retainedBytes,0);
});

test('EX-14/34 busy leases reject concurrent execution/release and expiry is explicit',()=>{
  const store=new Workspaces(),batch=store.prepare(input(),model);store.acquire(batch.id);
  assert.equal(batch.revision,1);
  assert.throws(()=>store.acquire(batch.id),{code:'batch_busy'});
  assert.throws(()=>store.release(batch.id),{code:'batch_busy'});
  assert.throws(()=>store.clear(),{code:'batch_busy'});
  store.finish(batch.id);store.clear();assert.throws(()=>store.get(batch.id),{code:'batch_expired'});
});

test('EX-11/16 validated completion keeps abstention distinct, malformed answers retain reservation',()=>{
  const store=new Workspaces(),raw=input();
  raw.questions.q={type:'choice',instructions:'Fixture?',criteria:{yes:'yes',unknown:'not enough'}};raw.abstainChoices={q:['unknown']};
  const batch=store.prepare(raw,model);store.acquire(batch.id);const token=store.reserveAnswer(batch.id);
  assert.throws(()=>store.completeAnswer(token,0,{q:{type:'bool',probability:0.5}}),{code:'invalid_response'});
  assert.equal(store.reservedBytes,BOUNDS.answerBytes);
  store.completeAnswer(token,0,{q:{type:'choice',choice:'unknown',confidence:1,probabilities:{yes:0,unknown:1}}});
  assert.deepEqual(batch.outcomes[0].abstainedQuestionIds,['q']);assert.equal(batch.outcomes[0].status,'completed');
  assert.equal(store.reservedBytes,0);
});
