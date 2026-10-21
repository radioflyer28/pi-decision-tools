import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js';
import { createEventBus } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/event-bus.js';
import { installOwner } from '../dist/pi/owner.js';
import { registerLifecycle } from '../dist/pi/lifecycle.js';
import { DEFAULT_LIMITS } from '../dist/core/validation.js';
import { temporaryFixture, FakeClassifier, deferred } from './helpers/fixtures.mjs';
const model={type:'classifier',provider:'fake',id:'fixture',name:'Fixture',api:'fake',baseUrl:'https://fixture.invalid',input:['text'],contextWindow:10000,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
const input=(run)=>({predicate:'Supported?',records:Array.from({length:10},(_,i)=>({id:String(i),text:`synthetic-${i}`})),...(run?{run}:{})});
const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
async function setup(t,actions=[]){
  const f=temporaryFixture(t),session=SessionManager.create(f.root,f.sessions);
  session.appendMessage({role:'user',content:'Synthetic lifecycle fixture.',timestamp:Date.now()});
  const bus=createEventBus(),hooks=new Map(),fake=new FakeClassifier(...actions),notices=[];
  const pi={events:bus,on(name,fn){hooks.set(name,fn);},appendEntry(type,data){session.appendCustomEntry(type,data);}};
  const owner=installOwner(pi),ctx={sessionManager:session,modelRegistry:{getAvailableOfType:async()=>[model],classify:fake.classify},ui:{notify:(...args)=>notices.push(args)}};
  registerLifecycle(pi,owner,()=>({version:1,families:{generic:true,semantic:true},limits:{...DEFAULT_LIMITS,concurrency:1}}),async()=>{await owner.coordinator.classifier.refresh();});
  const event=async(name,args={})=>hooks.get(name)?.(args,ctx);
  await event('session_start',{reason:'startup'});owner.enable(session.getSessionId());
  t.after(()=>owner.dispose());
  return {owner,session,fake,notices,event,bus,service:()=>owner.semantic(session.getSessionId())};
}
const page=(service,id)=>service.results.page({operationId:id});
const resume=(service,id)=>({operationId:id,expectedIdentity:page(service,id).value.identity,run:{}});

test('semantic owner preserves compaction and cancelled tree, resumes only after explicit enable, expires successful tree',async t=>{
  const h=await setup(t),s=h.service(),first=await s.execution.filter(input({maxRequests:1})),id=first.operationId;
  const before=h.owner.coordinator.controls.ledger.snapshot().totals;
  h.session.appendCompaction('Synthetic summary.',h.session.getEntries().find(e=>e.type==='message').id,20);
  await h.event('session_compact');assert.equal(h.service(),s);assert.equal(page(s,id).value.coverage.initial.judged,1);
  await h.event('session_before_tree');assert.equal(page(s,id).ok,true);
  await assert.rejects(()=>s.execution.filter(input()),{code:'disabled'});
  await assert.rejects(()=>s.execution.continue(resume(s,id)),{code:'disabled'});
  h.owner.enable(h.session.getSessionId());await s.execution.continue({...resume(s,id),run:{maxRequests:1}});
  assert.equal(h.fake.calls.length,2);
  await h.event('session_tree');assert.notEqual(h.service(),s);assert.equal(page(h.service(),id).error.code,'search_expired');
  assert.equal(page(s,id).error.code,'search_expired');await assert.rejects(()=>s.execution.filter(input()),{code:'runtime_expired'});
  assert.equal(h.owner.coordinator.memory.retainedBytes,0);assert.equal(h.owner.coordinator.memory.reservedBytes,0);
  assert.equal(h.owner.coordinator.controls.ledger.snapshot().totals.chargedRequests,before.chargedRequests+1);
});

test('owner pause gates synchronously and waits for abort-ignoring native settlement before re-enable',async t=>{
  const gate=deferred(),h=await setup(t,[()=>gate.promise]),s=h.service();
  const running=s.execution.filter(input({}));await flush();assert.equal(h.fake.active,1);
  let drained=false;const pause=h.owner.pause().then(()=>{drained=true;});
  await assert.rejects(()=>s.execution.filter(input()),{code:'disabled'});
  assert.throws(()=>h.owner.enable(h.session.getSessionId()),{code:'runtime_busy'});
  await flush();assert.equal(drained,false);assert.equal(h.fake.calls[0].aborted,true);assert.equal(h.owner.coordinator.scheduler.active,1);
  gate.resolve({api:'fake',provider:'fake',model:'fixture',answers:{},stopReason:'aborted',timestamp:0});
  const result=await running;await pause;
  assert.equal(h.fake.calls.length,1);assert.equal(page(s,result.operationId).value.coverage.initial.pending,9);
  assert.equal(h.owner.coordinator.controls.ledger.snapshot().totals.chargedRequests,1);
  h.owner.enable(h.session.getSessionId());assert.equal(h.owner.coordinator.controls.enabled,true);
});

for(const reason of ['resume','switch','fork','new','reload','quit']) test(`semantic lifecycle ${reason} drains then expires old service without replay`,async t=>{
  const gate=deferred(),h=await setup(t,[()=>gate.promise]),s=h.service(),core=h.owner.coordinator;
  const prepared=await s.execution.filter(input()),id=prepared.operationId;
  const running=s.execution.continue(resume(s,id));await flush();
  let stopped=false;const shutdown=h.event('session_shutdown',{reason}).then(()=>{stopped=true;});
  await flush();assert.equal(stopped,false);assert.equal(h.fake.active,1);
  await assert.rejects(()=>s.execution.filter(input()),{code:'runtime_expired'});
  gate.resolve({api:'fake',provider:'fake',model:'fixture',answers:{},stopReason:'aborted',timestamp:0});
  await running;await shutdown;assert.equal(h.fake.calls.length,1);assert.equal(page(s,id).error.code,'search_expired');
  assert.equal(core.memory.retainedBytes,0);assert.equal(core.memory.reservedBytes,0);assert.equal(core.controls.ledger.snapshot().totals.chargedRequests,1);
  if(reason!=='reload'&&reason!=='quit'){
    await h.event('session_start',{reason});assert.equal(h.owner.coordinator.controls.enabled,false);
    assert.equal(page(h.service(),id).error.code,'search_expired');assert.equal(h.owner.coordinator.controls.ledger.snapshot().totals.chargedRequests,1);
  }
});

test('overlapping retire/start waits for old native work and navigation cannot clear replacement runtime',async t=>{
  const gate=deferred(),h=await setup(t,[()=>gate.promise]),old=h.service();
  const running=old.execution.filter(input({}));await flush();
  const navigation=h.owner.navigate(),retirement=h.owner.retire();
  let started=false;const replacement=h.event('session_start',{reason:'resume'}).then(()=>{started=true;});
  await flush();assert.equal(started,false);assert.equal(h.owner.coordinator,undefined);
  gate.resolve({api:'fake',provider:'fake',model:'fixture',answers:{},stopReason:'aborted',timestamp:0});
  await running;await Promise.all([navigation,retirement,replacement]);assert.equal(started,true);assert.deepEqual(h.notices,[]);
  assert.equal(h.owner.coordinator.controls.enabled,false);h.owner.enable(h.session.getSessionId());
  const prepared=await h.service().execution.filter(input());assert.equal(page(h.service(),prepared.operationId).ok,true);
  assert.equal(h.fake.calls.length,1);
});

test('before switch/fork retains disabled parents and discovery conflict closes semantic admission',async t=>{
  const h=await setup(t),s=h.service(),result=await s.execution.filter(input());
  for(const event of ['session_before_switch','session_before_fork']){
    await h.event(event);assert.equal(page(s,result.operationId).ok,true);
    await assert.rejects(()=>s.execution.filter(input()),{code:'disabled'});h.owner.enable(h.session.getSessionId());
  }
  h.bus.emit('pi-decision-tools:conflict',{});
  await assert.rejects(()=>s.execution.filter(input()),{code:'disabled'});
  assert.throws(()=>h.service(),{code:'coordinator_conflict'});assert.equal(h.fake.calls.length,0);
});
