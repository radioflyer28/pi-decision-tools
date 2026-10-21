import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {Check} from 'typebox/value';
import {SessionManager} from '../node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js';
import {Coordinator} from '../dist/core/coordinator.js';
import {ExecutionControls} from '../dist/core/controls.js';
import {DEFAULT_LIMITS} from '../dist/core/validation.js';
import {ClassifierAdapter} from '../dist/pi/classifier-adapter.js';
import {SessionLedger} from '../dist/pi/session-adapter.js';
import {SemanticExecution} from '../dist/semantic/execution.js';
import {SemanticResults} from '../dist/semantic/results.js';
import {semanticEnvelopeSchema} from '../dist/semantic/schemas.js';
import {temporaryFixture,FakeClassifier,fakeUsage,deferred} from './helpers/fixtures.mjs';
const model={type:'classifier',provider:'fake',id:'fixture',name:'Fixture',api:'fake',baseUrl:'https://fixture.invalid',input:['text'],contextWindow:10000,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
async function setup(t,{exclusions=[],hooks,limits={}}={}){
  const f=temporaryFixture(t),session=SessionManager.create(f.root,f.sessions);
  session.appendMessage({role:'user',content:'Synthetic search fixture',timestamp:0});
  const ledger=new SessionLedger(session,(type,data)=>session.appendCustomEntry(type,data)),fake=new FakeClassifier();
  const classifier=new ClassifierAdapter({getAvailableOfType:async()=>[model],classify:fake.classify});await classifier.refresh();
  const controls=new ExecutionControls(ledger,classifier.available,{version:1,families:{generic:true,semantic:true},limits:{...DEFAULT_LIMITS,...limits}});
  const core=new Coordinator(controls,classifier);controls.enable();
  const engine=new SemanticExecution(core,undefined,{root:f.root,fileExclusions:exclusions,hooks}),results=new SemanticResults(engine.parents);
  t.after(async()=>{await engine.expire();await core.expire();});return {f,core,engine,results,fake,ledger};
}

test('search preparation returns owned captured file coverage without classifier work',async t=>{
  const {f,engine,results,fake,ledger}=await setup(t,{exclusions:['b.txt']});
  writeFileSync(join(f.root,'a.txt'),'hello');writeFileSync(join(f.root,'b.txt'),'synthetic user-excluded');writeFileSync(join(f.root,'.env'),'synthetic sensitive');
  assert.equal(typeof engine.search,'function','systematic search must exist at the semantic runtime boundary');
  const created=await engine.search({predicate:'Has a greeting?',scope:{paths:['b.txt','.env','a.txt']}});
  const result=results.page({operationId:created.operationId});assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(Check(semanticEnvelopeSchema,result),true);const page=result.value;
  assert.equal(page.kind,'search');assert.equal(page.mode,'systematic');assert.equal(page.state,'prepared');assert.equal(page.complete,false);
  assert.deepEqual(page.coverage.initial,{total:1,judged:0,failed:0,pending:1,running:0});
  assert.deepEqual(page.coverage.files,{captured:1,excluded:2});assert.equal(page.coverage.enumeration.complete,true);
  assert.deepEqual(page.coverage.exclusions.map(x=>[x.path,x.reason]),[['.env','sensitive'],['b.txt','user_excluded']]);
  const item=page.items[0];assert.equal(item.status,'pending');assert.equal(item.evidence.kind,'file');assert.equal(item.evidence.verification,'captured');
  assert.equal(item.evidence.path,'a.txt');assert.equal(item.evidence.startLine,1);assert.equal(item.evidence.endLine,1);
  assert.equal(item.evidence.textHash,'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  assert.equal(item.snippet.text,'hello');assert.equal(item.snippet.path,'a.txt');assert.equal(item.snippet.freshness,'captured');
  assert.equal(fake.calls.length,0);assert.equal(ledger.snapshot().totals.chargedRequests,0);assert.equal(created.usageDelta,undefined);
});

test('a capture limit stays explicit while retained windows are pending',async t=>{
  const {f,engine,results,fake}=await setup(t,{limits:{maxWorkMs:60000}});execFileSync('git',['init','-q',f.root]);
  for(let i=0;i<257;i++)writeFileSync(join(f.root,`${String(i).padStart(3,'0')}.txt`),'hello');
  const created=await engine.search({predicate:'Has a greeting?'}),result=results.page({operationId:created.operationId});
  assert.equal(result.ok,true,JSON.stringify(result));const p=result.value;
  assert.equal(p.stopReason,'scope_limit');assert.equal(p.complete,false);assert.equal(p.state,'partial');
  assert.equal(p.coverage.files.captured,256);assert.equal(p.coverage.initial.pending,256);
  assert.equal(p.coverage.enumeration.remainingCandidates,null);assert.equal(p.continuation.canResume,true);assert.equal(fake.calls.length,0);
});

test('disable drains in-flight source acquisition and rejects late parent admission',async t=>{
  const entered=deferred(),finish=deferred();
  const {f,engine,core,results,fake}=await setup(t,{hooks:{beforeOpen:async()=>{entered.resolve();await finish.promise;}}});
  writeFileSync(join(f.root,'a.txt'),'hello');let drained=false,draining,outcome;
  const running=engine.search({predicate:'Greeting?',scope:{paths:['a.txt']}}).then(result=>({result}),error=>({error:error.code}));
  try{
    assert.equal(await Promise.race([entered.promise.then(()=> 'reading'),running.then(()=> 'finished')]),'reading');
    engine.pause();core.disable();draining=engine.drain().then(()=>{drained=true;});
    await new Promise(resolve=>setImmediate(resolve));assert.equal(drained,false,'disable must await the real source read');
  }finally{finish.resolve();outcome=await running;if(draining)await draining;}
  assert.equal(outcome.error,'disabled');assert.equal(fake.calls.length,0);assert.equal(core.memory.retainedBytes,0);assert.equal(core.memory.reservedBytes,0);
  assert.equal(results.page({operationId:'sem-missing'}).error.code,'search_expired');
});

test('systematic search can settle more than32 children without losing judgments or charging twice',async t=>{
  const {f,engine,results,fake,ledger}=await setup(t,{limits:{requests:400,maxWorkMs:60000}});
  writeFileSync(join(f.root,'many.txt'),'z\n'.repeat(64+56*271));
  const created=await engine.search({predicate:'Cancellation before scheduling?',scope:{paths:['many.txt']},run:{maxRequests:64}});
  assert.equal(created.error,undefined,'completed children must not permanently consume all32 slots');
  let first=results.page({operationId:created.operationId,limit:100}),tokens=created.usageDelta?.totalTokens??0;assert.equal(first.ok,true);
  // The contract allows sufficient allowance across invocations, not a wall-clock speed guarantee.
  for(let i=0;!first.value.complete&&i<8;i++){
    const next=await engine.continue({operationId:created.operationId,expectedIdentity:first.value.identity,run:{maxRequests:64}});
    assert.equal(next.error,undefined,'settled child slots must remain reusable');tokens+=next.usageDelta?.totalTokens??0;
    first=results.page({operationId:created.operationId,limit:100});assert.equal(first.ok,true);
  }
  assert.equal(first.value.complete,true);assert.deepEqual(first.value.coverage.initial,{total:272,judged:272,failed:0,pending:0,running:0});
  assert.equal(fake.calls.length,272);assert.equal(ledger.snapshot().totals.chargedRequests,272);
  assert.equal(tokens,2720);assert.equal(first.value.usage[0].usage.totalTokens,2720);
  let page=first.value,seen=[];for(;;){seen.push(...page.items.map(x=>x.evidence.evidenceId));if(!page.page.nextCursor)break;
    const next=results.page({operationId:created.operationId,limit:100,cursor:page.page.nextCursor});assert.equal(next.ok,true);page=next.value;}
  assert.equal(seen.length,272);assert.equal(new Set(seen).size,272);assert.equal(fake.calls.length,272);
});
