import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,unlinkSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {Check} from 'typebox/value';
import {semanticEnvelopeSchema} from '../dist/semantic/schemas.js';
import {prepareSearch} from '../dist/semantic/preparation.js';
import {searchFixture} from './helpers/search.mjs';
import {fakeUsage,FakeClock,deferred} from './helpers/fixtures.mjs';
const answer=(choice='match',p=1)=>({api:'fake',provider:'fake',model:'fixture',stopReason:'stop',timestamp:0,usage:fakeUsage(),answers:{relevance:{type:'choice',choice,probabilities:choice==='match'?{match:p,no_match:1-p,insufficient_context:0}:choice==='no_match'?{match:0,no_match:1,insufficient_context:0}:{match:0,no_match:0,insufficient_context:1},confidence:1}}});
const actions=(n,choice='match',p=1)=>Array.from({length:n},()=>async()=>answer(choice,p));
const resume=(p,extra={})=>({operationId:p.operationId,expectedIdentity:p.identity,run:{},...extra});
function page(h,id,extra={}){const p=h.results.page({operationId:typeof id==='string'?id:id.operationId,...extra});assert.equal(p.ok,true,JSON.stringify(p));assert.equal(Check(semanticEnvelopeSchema,p),true);return p.value;}
async function fixture(t,n=24,options={}){const h=await searchFixture(t,{...options,actions:[...(options.actions??[]),...actions(n)],limits:{concurrency:1,...options.limits}});h.path=join(h.f.root,'a.txt');writeFileSync(h.path,'synthetic\n'.repeat(64+56*(n-1)));h.input={predicate:'Supported behavior?',mode:'discovery',scope:{paths:['a.txt']}};return h;}

test('discovery preparation is copied and targets/views reject on non-discovery parents',async t=>{
  let reads=0;const h=await fixture(t,10,{hooks:{beforeOpen:async()=>{reads++;}}});
  for(const targetMatches of [0,101,-1,1.1,null,'5'])await assert.rejects(h.engine.search({...h.input,targetMatches}),{code:'invalid_input'});
  assert.equal(reads,0);assert.equal(h.core.memory.retainedBytes,0);
  const input={...h.input,policy:{version:1,minMatchProbability:0.8}},s=await h.engine.search(input);input.policy.minMatchProbability=0;
  const p=page(h,s);assert.equal(p.mode,'discovery');assert.equal(p.targetMatches,5);assert.equal(p.stopPolicy.minMatchProbability,0.8);assert.deepEqual(p.items,[]);assert.equal(p.coverage.initial.pending,10);assert.equal(p.yieldProgress.matched,0);assert.equal(h.fake.calls.length,0);
  assert.equal(page(h,s,{view:'all'}).items.length,10);assert.ok(h.core.memory.retainedBytes>0);assert.ok(h.core.memory.reservedBytes>0);
  const systematic=await h.engine.search({...h.input,mode:'systematic'}),sp=page(h,systematic);
  await assert.rejects(h.engine.continue(resume(sp,{targetMatches:1})),{code:'invalid_input'});
  assert.equal(h.results.page({operationId:sp.operationId,view:'all'}).error.code,'invalid_input');assert.equal(page(h,sp).revision,0);
  const record=await h.engine.filter({predicate:'Fixture?',records:[{id:'r',text:'data'}]}),rp=page(h,record);
  await assert.rejects(h.engine.continue(resume(rp,{targetMatches:1})),{code:'invalid_input'});
  assert.equal(h.results.page({operationId:rp.operationId,view:'matches'}).error.code,'invalid_input');
});

test('discovery identity pins stop policy and mode but not target or result view',()=>{
  const model={provider:'fake',id:'fixture',api:'fake',configurationFingerprint:'a'.repeat(64),backendVersionKnown:false};
  const capture={summary:()=>({rootId:'root',snapshotId:'a'.repeat(64)}),evidence:()=>[]};
  const base={predicate:'Fixture?',mode:'discovery',policy:{version:1,minMatchProbability:0.8}};
  const a=prepareSearch(base,model,capture),b=prepareSearch({...base,targetMatches:100},model,capture);
  assert.equal(a.identity,b.identity);assert.notEqual(a.identity,prepareSearch({...base,policy:{version:1,minMatchProbability:0.9}},model,capture).identity);
  assert.notEqual(a.identity,prepareSearch({...base,mode:'systematic'},model,capture).identity);
  assert.equal(Object.isFrozen(a.policy),true);
});

test('dense discovery yields between children and plain continue returns only additional hits',async t=>{
  const h=await fixture(t),s=await h.engine.search({...h.input,run:{}}),p=page(h,s);
  assert.equal(p.stopReason,'target_reached');assert.equal(p.complete,false);assert.equal(p.items.length,8);assert.equal(p.yieldProgress.matched,8);assert.equal(p.coverage.initial.pending,16);assert.equal(s.usageDelta.totalTokens,80);assert.equal(h.fake.calls.length,8);
  const first=p.items.map(i=>i.evidence.evidenceId),s2=await h.engine.continue(resume(p)),p2=page(h,s2);
  assert.equal(p2.targetMatches,5);assert.equal(p2.stopReason,'target_reached');assert.equal(p2.items.length,8);assert.ok(p2.items.every(i=>!first.includes(i.evidence.evidenceId)));assert.equal(p2.outcomeCounts.match,16);
  assert.equal(page(h,p2,{view:'matches'}).items.length,16);assert.equal(page(h,p2,{view:'all'}).coverage.initial.pending,8);
  assert.equal(h.fake.calls.length,16);assert.equal(s2.usageDelta.totalTokens,80);assert.equal(p2.usage[0].usage.totalTokens,160);
  const last=await h.engine.continue(resume(p2)),done=page(h,last);assert.equal(done.complete,true);assert.equal(done.stopReason,'complete');assert.equal(done.items.length,8);assert.equal(h.fake.calls.length,24);
  const empty=await h.engine.continue(resume(done));assert.equal(page(h,empty).items.length,0);assert.equal(page(h,empty,{view:'matches',limit:100}).items.length,24);assert.equal(h.fake.calls.length,24);
  const charged=h.ledger.snapshot().totals.chargedRequests;h.engine.parents.release(done.operationId);assert.equal(h.core.memory.retainedBytes,0);assert.equal(h.core.memory.reservedBytes,0);assert.equal(h.ledger.snapshot().totals.chargedRequests,charged);
});

test('sparse late relevance scans across internal batches without padding or premature yield',async t=>{
  const h=await fixture(t,32,{actions:[...actions(8,'no_match'),...actions(8,'insufficient_context'),...actions(8,'match',0.4),...actions(8)]});
  const s=await h.engine.search({...h.input,policy:{version:1,minMatchProbability:0.8},run:{}}),p=page(h,s);
  assert.equal(h.fake.calls.length,32);assert.equal(p.complete,true);assert.equal(p.items.length,8);assert.equal(p.yieldProgress.matched,8);assert.deepEqual(p.outcomeCounts,{match:8,noMatch:8,unresolved:16});
  assert.ok(p.items.every(i=>i.outcome==='match'&&i.raw.answer.probabilities.match>=0.8));
  const lower=page(h,s,{policy:{version:1,minMatchProbability:0}});assert.equal(lower.items.length,16);assert.equal(lower.yieldProgress.matched,8);assert.equal(lower.stopPolicy.minMatchProbability,0.8);assert.equal(h.fake.calls.length,32);
});

test('forced no-hit handoff and later progress retain distinct failures and unknown usage',async t=>{
  const h=await fixture(t,12,{actions:[...actions(7,'no_match'),async()=>answer('insufficient_context'),async()=>({...answer(),stopReason:'error',usage:undefined})]});
  const s=await h.engine.search({...h.input,run:{maxRequests:9}}),p=page(h,s);
  assert.equal(p.stopReason,'call_limit');assert.equal(p.items.length,0);assert.equal(p.yieldProgress.matched,0);assert.equal(p.coverage.initial.failed,1);assert.equal(p.outcomeCounts.unresolved,1);assert.equal(p.coverage.initial.pending,3);assert.equal(p.ledger.chargedRequests,9);assert.equal(p.diagnostics.unknownUsageAttempts,1);
  const all=page(h,s,{view:'all'});assert.equal(all.items[8].status,'failed');assert.equal(all.items[7].outcome,'unresolved');
  const end=await h.engine.continue(resume(p));assert.equal(page(h,end).items.length,3);assert.equal(page(h,end).complete,true);assert.equal(h.fake.calls.length,12);
});

test('target changes and mixed invalid retries are atomic; zero budget never repeats old hits',async t=>{
  const h=await fixture(t),s=await h.engine.search({...h.input,run:{}}),p=page(h,s);
  const before=JSON.stringify(h.engine.parents.get(p.operationId));
  for(const extra of [{targetMatches:0},{targetMatches:2,expectedIdentity:'f'.repeat(64)},{targetMatches:2,retryFailedEvidenceIds:[p.items[0].evidence.evidenceId]}])await assert.rejects(h.engine.continue(resume(p,extra)));
  assert.equal(JSON.stringify(h.engine.parents.get(p.operationId)),before);assert.equal(h.fake.calls.length,8);
  const zero=await h.engine.continue(resume(p,{targetMatches:2,run:{maxRequests:0}})),z=page(h,zero);assert.equal(z.targetMatches,2);assert.equal(z.items.length,0);assert.equal(z.stopReason,'call_limit');assert.equal(h.fake.calls.length,8);assert.equal(page(h,z,{view:'matches'}).items.length,8);
  const next=await h.engine.continue(resume(z));assert.equal(page(h,next).targetMatches,2);assert.equal(page(h,next).items.length,8);assert.equal(h.fake.calls.length,16);
});

test('filtered cursors bind selection and cutoff; paging never schedules or loses matches',async t=>{
  const h=await fixture(t,24,{actions:Array.from({length:24},(_,i)=>async()=>answer(i%2?'match':'no_match'))});
  const s=await h.engine.search({...h.input,targetMatches:100,run:{}}),p=page(h,s,{limit:2});let cursor=p.page.nextCursor;const ids=p.items.map(i=>i.evidence.evidenceId);
  assert.ok(cursor);for(const extra of [{view:'all'},{view:'matches'},{policy:{version:1,minMatchProbability:0.5}},{limit:3}])assert.equal(h.results.page({operationId:p.operationId,cursor,limit:2,...extra}).error.code,'cursor_invalid');
  while(cursor){const q=page(h,s,{limit:2,cursor});assert.ok(q.items.length>0);ids.push(...q.items.map(i=>i.evidence.evidenceId));cursor=q.page.nextCursor;}
  assert.equal(ids.length,12);assert.equal(new Set(ids).size,12);assert.equal(h.fake.calls.length,24);
  await h.engine.continue(resume(p,{run:{maxRequests:0}}));assert.equal(h.results.page({operationId:p.operationId,limit:2,cursor:p.page.nextCursor}).error.code,'cursor_stale');
});

test('continuation uses captured bytes after deletion and systematic mode never target-yields',async t=>{
  let reads=0;const h=await fixture(t,10,{hooks:{beforeOpen:async()=>{reads++;}}}),s=await h.engine.search({...h.input,targetMatches:1,run:{}}),p=page(h,s),count=reads;
  unlinkSync(h.path);await h.engine.continue(resume(p));assert.equal(reads,count);assert.equal(h.fake.calls.length,10);assert.ok(h.fake.calls.every(c=>c.request.state.evidence.text.includes('synthetic')));
  writeFileSync(h.path,'systematic\n'.repeat(64+56*9));const sys=await h.engine.search({...h.input,mode:'systematic',run:{}});assert.equal(page(h,sys).complete,true);assert.equal(page(h,sys).mode,'systematic');assert.equal(page(h,sys).items.length,10);assert.equal(h.fake.calls.length,20);
});


test('successful explicit retries qualify once and preserve later retry obligations',async t=>{
  const aborted=async()=>({...answer(),stopReason:'aborted',usage:undefined});
  const h=await fixture(t,18,{actions:[aborted,...actions(7),aborted,...actions(9)]});
  const s=await h.engine.search({...h.input,targetMatches:100,run:{}}),all=page(h,s,{view:'all'}),failed=all.items.filter(i=>i.status==='failed');assert.equal(failed.length,2);
  const ids=failed.map(i=>i.evidence.evidenceId),before=JSON.stringify(h.engine.parents.get(s.operationId));
  await assert.rejects(h.engine.continue(resume(all,{targetMatches:1,retryFailedEvidenceIds:[ids[0],all.items[1].evidence.evidenceId]})),{code:'invalid_retry_selection'});assert.equal(JSON.stringify(h.engine.parents.get(s.operationId)),before);
  const retried=await h.engine.continue(resume(all,{targetMatches:1,retryFailedEvidenceIds:ids})),r=page(h,retried);
  assert.equal(r.yieldProgress.matched,1);assert.equal(r.items.length,1);assert.equal(r.items[0].evidence.evidenceId,ids[0]);assert.equal(r.items[0].attempts,2);assert.equal(h.fake.calls.length,19);
  const remaining=page(h,r,{view:'all'}).items.find(i=>i.evidence.evidenceId===ids[1]);assert.equal(remaining.status,'failed');assert.equal(remaining.attempts,1);assert.equal(remaining.error.retryEligible,true);
  await h.engine.continue(resume(r,{retryFailedEvidenceIds:[ids[1]]}));assert.equal(h.fake.calls.length,20);assert.equal(page(h,r).items[0].evidence.evidenceId,ids[1]);assert.equal(page(h,r).ledger.chargedRequests,20);
});

for(const cause of ['model','deadline','cancelled','storage'])test(`coincident ${cause} execution constraint is not hidden by a relevance target`,async t=>{
  const timer=new FakeClock(),clock={now:()=>timer.now,setTimeout:timer.setTimeout,clearTimeout:timer.clearTimeout},abort=new AbortController();
  const h=await fixture(t,16,{clock,limits:{maxWorkMs:100,maxAttemptMs:100}});h.models.push({...h.models[0],id:'other'});await h.classifier.refresh();
  h.fake.actions=[...actions(7),async()=>{if(cause==='model')h.controls.select(h.models[1]);if(cause==='deadline')timer.advance(100);if(cause==='cancelled')abort.abort();if(cause==='storage')h.session.appendCustomEntry=()=>{throw new Error('synthetic storage fault');};return answer();},...actions(8)];
  const s=await h.engine.search({...h.input,targetMatches:1,run:{}},{signal:abort.signal}),p=page(h,s);
  assert.equal(p.stopReason,{model:'model_policy_mismatch',deadline:'deadline',cancelled:'cancelled',storage:'storage_error'}[cause]);assert.equal(h.fake.calls.length,8);assert.equal(p.coverage.initial.pending,8);assert.equal(p.ledger.chargedRequests,8);assert.ok(p.items.every(i=>i.outcome==='match'));assert.equal(timer.timers.size,0);
});

test('discovery retains more than32 children without losing prior judgments or memory accounting',async t=>{
  const h=await fixture(t,272,{limits:{requests:400,inputBytes:4194304,maxWorkMs:60000,maxAttemptMs:5000}});
  const s=await h.engine.search({...h.input,targetMatches:100,run:{maxRequests:64,maxWorkMs:60000}});let p=page(h,s),seen=new Set();
  while(true){const full=page(h,p,{view:'all',limit:100});assert.equal(full.coverage.initial.total,272);for(const i of p.items)seen.add(i.evidence.evidenceId);if(p.complete)break;await h.engine.continue(resume(p,{run:{maxRequests:64,maxWorkMs:60000}}));p=page(h,p);}
  const ids=[];let cursor;do{const q=page(h,p,{view:'matches',limit:100,...(cursor?{cursor}:{})});ids.push(...q.items.map(i=>i.evidence.evidenceId));cursor=q.page.nextCursor;}while(cursor);
  assert.equal(ids.length,272);assert.equal(new Set(ids).size,272);assert.equal(h.fake.calls.length,272);assert.equal(p.ledger.chargedRequests,272);assert.equal(p.usage[0].usage.totalTokens,2720);
  assert.ok(h.core.memory.retainedBytes+h.core.memory.reservedBytes<=8388608);h.engine.parents.release(p.operationId);assert.equal(h.core.memory.retainedBytes,0);assert.equal(h.core.memory.reservedBytes,0);assert.equal(h.ledger.snapshot().totals.chargedRequests,272);
});

test('changing query or actual Git directory scope creates a separate frozen operation',async t=>{
  const h=await fixture(t,1);execFileSync('git',['init','-q',h.f.root]);for(const dir of ['one','two']){mkdirSync(join(h.f.root,dir));writeFileSync(join(h.f.root,dir,'entry.txt'),'synthetic '+dir);}
  const a=await h.engine.search({...h.input,scope:{paths:['one']}}),before=page(h,a,{view:'all'});
  await assert.rejects(h.engine.continue({...resume(before),scope:{paths:['two']}}),{code:'invalid_input'});assert.deepEqual(page(h,a,{view:'all'}),before);
  const b=await h.engine.search({...h.input,scope:{paths:['two']},predicate:'Different predicate?'}),after=page(h,b,{view:'all'});
  assert.notEqual(after.operationId,before.operationId);assert.notEqual(after.identity,before.identity);assert.equal(before.items[0].evidence.path,'one/entry.txt');assert.equal(after.items[0].evidence.path,'two/entry.txt');assert.equal(h.fake.calls.length,0);
});

for(const bound of ['invocation','session'])test(`exact ${bound} budget exhaustion outranks a coincident target`,async t=>{
  const h=await fixture(t,16,bound==='session'?{limits:{requests:16}}:{});
  if(bound==='session')await h.engine.filter({predicate:'Earlier shared record work?',records:Array.from({length:8},(_,i)=>({id:String(i),text:'synthetic '+i})),run:{}});
  const previous=h.fake.calls.length;
  const s=await h.engine.search({...h.input,targetMatches:5,run:bound==='invocation'?{maxRequests:8}:{}}),p=page(h,s);
  assert.equal(p.stopReason,bound==='invocation'?'call_limit':'budget_exhausted');assert.equal(p.items.length,8);assert.equal(p.yieldProgress.matched,8);assert.equal(p.coverage.initial.pending,8);assert.equal(h.fake.calls.length,previous+8);assert.equal(p.ledger.chargedRequests,previous+8);
});

for(const teardown of ['disable','expiry'])test(`concurrent discovery/generic/record ${teardown} drains abort-ignoring providers`,async t=>{
  const h=await fixture(t,2,{limits:{concurrency:2}}),gEntered=deferred(),sEntered=deferred(),finish=deferred();
  const s=await h.engine.search(h.input),p=page(h,s),r=await h.engine.filter({predicate:'Queued record?',records:[{id:'r',text:'synthetic'}]}),rp=h.results.page(r).value;
  h.fake.actions=[async()=>{gEntered.resolve();await finish.promise;return {...answer(),answers:{q:{type:'bool',probability:1}}};},async()=>{sEntered.resolve();await finish.promise;return {...answer(),stopReason:'aborted',usage:undefined};}];
  const generic=h.core.submit({items:[{id:'g',inputVersion:'1',state:{synthetic:true}}],rubricVersion:'fixture',questions:{q:{type:'bool',instructions:'Fixture?',criteria:{true:'yes',false:'no'}}},run:{maxRequests:1}});await gEntered.promise;
  const discovery=h.engine.continue(resume(p,{run:{maxRequests:1}}));await sEntered.promise;
  const record=h.engine.continue({operationId:rp.operationId,expectedIdentity:rp.identity,run:{maxRequests:1}}),runs=Promise.allSettled([generic,discovery,record]);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(h.fake.calls.length,2);assert.equal(h.fake.peak,2);assert.throws(()=>h.engine.parents.release(p.operationId),{code:'search_busy'});
  h.engine.pause();h.core.disable();let ended=false;
  // Match the production owner's order: parent cleanup needs live child workspaces.
  const ending=(teardown==='expiry'?(async()=>{try{await h.engine.expire();}finally{await h.core.expire();}})():Promise.all([h.engine.drain(),h.core.drain()])).then(()=>{ended=true;});
  try{await new Promise(resolve=>setImmediate(resolve));assert.equal(ended,false);assert.equal(h.fake.active,2);assert.ok(h.core.memory.retainedBytes>0);}
  finally{finish.resolve();await runs;await ending;}
  assert.equal(h.fake.calls.length,2);assert.equal(h.fake.active,0);assert.equal(h.ledger.snapshot().totals.chargedRequests,2);assert.equal(h.ledger.snapshot().totals.unknownAttempts,1);
  if(teardown==='disable'){const retained=page(h,p,{view:'all'});assert.equal(retained.stopReason,'disabled');assert.equal(retained.coverage.initial.pending,1);assert.equal(retained.diagnostics.unknownUsageAttempts,1);}
  else assert.equal(h.results.page({operationId:p.operationId}).error.code,'search_expired');
  await h.engine.expire();await h.core.expire();assert.equal(h.core.memory.retainedBytes,0);assert.equal(h.core.memory.reservedBytes,0);assert.equal(h.ledger.snapshot().totals.chargedRequests,2);
});

test('eligible same-generation reuse counts as newly qualified evidence without dispatch or duplicate usage',async t=>{
  const h=await fixture(t,16),first=await h.engine.search({...h.input,targetMatches:100,run:{maxRequests:4}}),original=page(h,first);
  assert.equal(original.items.length,4);assert.equal(h.fake.calls.length,4);
  const second=await h.engine.search({...h.input,targetMatches:1,run:{maxRequests:0}}),reused=page(h,second);
  assert.equal(reused.stopReason,'call_limit');assert.equal(reused.yieldProgress.matched,4);assert.equal(reused.items.length,4);assert.ok(reused.items.every(i=>i.raw.origin==='reuse'));assert.equal(reused.diagnostics.cacheHits,4);assert.equal(second.usageDelta,undefined);assert.equal(h.fake.calls.length,4);assert.equal(reused.ledger.chargedRequests,4);
  const revision=reused.revision;await h.engine.continue(resume(reused,{run:{maxRequests:0}}));const empty=page(h,second);assert.equal(empty.revision,revision+1);assert.equal(empty.yieldProgress.matched,0);assert.equal(empty.items.length,0);assert.equal(page(h,second,{view:'matches'}).items.length,4);assert.equal(h.fake.calls.length,4);
});
