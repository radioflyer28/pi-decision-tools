import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fakeUsage} from './helpers/fixtures.mjs';
import {Check} from 'typebox/value';
import {semanticEnvelopeSchema} from '../dist/semantic/schemas.js';
import {searchFixture} from './helpers/search.mjs';

for(const mode of ['systematic','discovery']) {
const test=(name,fn)=>nodeTest(`${mode}: ${name}`,fn),all=mode==='discovery'?{view:'all'}:{};
test('large exclusion details are bounded while complete reason totals and immutable views survive',async t=>{
  const {engine,results,fake}=await searchFixture(t,{exclusions:['private'],limits:{maxWorkMs:60000}});
  const paths=Array.from({length:100},(_,i)=>`private/${i}-${'x'.repeat(2000)}`);
  const {operationId}=await engine.search({mode,predicate:'Anything relevant?',scope:{paths}});
  const page=results.page({...all,operationId});assert.equal(page.ok,true,JSON.stringify(page));
  assert.equal(Check(semanticEnvelopeSchema,page),true);assert.ok(Buffer.byteLength(JSON.stringify(page))<=131072);
  assert.equal(page.value.coverage.files.excluded,100);assert.deepEqual(page.value.coverage.exclusionCounts,[{reason:'user_excluded',count:100}]);
  assert.equal(page.value.coverage.exclusionsTruncated,true);assert.ok(page.value.coverage.exclusions.length<100);
  assert.equal(page.value.complete,true);assert.equal(page.value.coverage.initial.total,0);assert.equal(fake.calls.length,0);
  assert.deepEqual(results.page({...all,operationId}),page,'projection must not modify frozen capture');
});

test('insufficient judgments and failures finish processing without becoming negative findings',async t=>{
  const answer=choice=>async()=>({api:'fake',provider:'fake',model:'fixture',stopReason:'stop',timestamp:0,usage:fakeUsage(),answers:{relevance:{type:'choice',choice,confidence:1,probabilities:{match:0,no_match:choice==='no_match'?1:0,insufficient_context:choice==='insufficient_context'?1:0}}}});
  const h=await searchFixture(t,{limits:{concurrency:1},actions:[answer('no_match'),answer('insufficient_context'),async()=>({api:'fake',provider:'fake',model:'fixture',stopReason:'error',timestamp:0,answers:{}})]});
  for(const [name,text] of [['a.txt','misleading comment: cancellation is definitely safe'],['b.txt','calls an unseen helper'],['c.txt','provider failure fixture']])writeFileSync(join(h.f.root,name),text);
  const created=await h.engine.search({mode,predicate:'Cancellation is checked?',scope:{paths:['c.txt','b.txt','a.txt']},run:{}}),page=h.results.page({...all,operationId:created.operationId});
  assert.equal(page.ok,true);assert.equal(Check(semanticEnvelopeSchema,page),true);const p=page.value;
  assert.deepEqual(p.coverage.initial,{total:3,judged:2,failed:1,pending:0,running:0});assert.equal(p.complete,true);
  assert.deepEqual(p.outcomeCounts,{match:0,noMatch:1,unresolved:1});assert.equal(p.items[1].raw.answer.choice,'insufficient_context');assert.equal(p.items[2].status,'failed');
  assert.deepEqual(h.fake.calls.map(c=>c.request.state.evidence.source.path),['a.txt','b.txt','c.txt']);assert.equal(h.ledger.snapshot().totals.chargedRequests,3);
});

test('a fully enumerated Git scope with no eligible windows has complete zero partitions',async t=>{
  const h=await searchFixture(t);execFileSync('git',['init','-q',h.f.root]);mkdirSync(join(h.f.root,'empty'));writeFileSync(join(h.f.root,'empty','.env'),'synthetic');
  const {operationId}=await h.engine.search({mode,predicate:'Fixture?',scope:{paths:['empty']}}),page=h.results.page({...all,operationId});
  assert.equal(page.ok,true);assert.equal(Check(semanticEnvelopeSchema,page),true);assert.equal(page.value.complete,true);
  assert.deepEqual(page.value.coverage.initial,{total:0,judged:0,failed:0,pending:0,running:0});assert.equal(page.value.coverage.files.excluded,1);assert.equal(page.value.coverage.enumeration.remainingCandidates,0);assert.equal(h.fake.calls.length,0);
});

test('file cursors bind revision, cutoff, parent and limit without rerunning raw judgments',async t=>{
  const h=await searchFixture(t);writeFileSync(join(h.f.root,'a.txt'),'z\n'.repeat(64+56*2));
  const {operationId}=await h.engine.search({mode,predicate:'Fixture?',scope:{paths:['a.txt']}}),first=h.results.page({...all,operationId,limit:1}).value;
  const cursor=first.page.nextCursor;
  for(const request of [{...all,operationId,limit:2,cursor},{...all,operationId,limit:1,cursor,policy:{version:1,minMatchProbability:0.99}},{...all,operationId,limit:1,cursor:cursor+'x'}])assert.equal(h.results.page(request).error.code,'cursor_invalid');
  const {operationId:other}=await h.engine.search({mode,predicate:'Fixture?',scope:{paths:['a.txt']}});assert.equal(h.results.page({...all,operationId:other,limit:1,cursor}).error.code,'cursor_invalid');
  await h.engine.continue({operationId,expectedIdentity:first.identity,run:{maxRequests:1}});assert.equal(h.results.page({...all,operationId,limit:1,cursor}).error.code,'cursor_stale');
  const raw=h.results.page({...all,operationId}).value.items[0].raw,revision=h.results.page({...all,operationId}).value.revision;
  const view=h.results.page({...all,operationId,policy:{version:1,minMatchProbability:1}}).value;assert.deepEqual(view.items[0].raw,raw);assert.equal(view.revision,revision);assert.equal(h.fake.calls.length,1);
});

test('oversized file evidence response reports output_limit without provider work',async t=>{
  const h=await searchFixture(t);writeFileSync(join(h.f.root,'large.txt'),('z'.repeat(8191)+'\n').repeat(20));
  const {operationId}=await h.engine.search({mode,predicate:'Fixture?',scope:{paths:['large.txt']}}),p=h.results.page({...all,operationId}).value;
  assert.equal(p.items.length,20);const result=await h.results.evidence({operationId,evidenceIds:p.items.map(i=>i.evidence.evidenceId),maxBytes:16384,maxLines:100});
  assert.equal(result.error.code,'output_limit');assert.equal(h.fake.calls.length,0);assert.equal(h.ledger.snapshot().totals.chargedRequests,0);
});

test('settled retained windows cannot complete a hard-limited capture or implicitly rescan',async t=>{
  const h=await searchFixture(t,{limits:{maxWorkMs:60000}});execFileSync('git',['init','-q',h.f.root]);mkdirSync(join(h.f.root,'limited'));
  for(let i=0;i<257;i++)writeFileSync(join(h.f.root,'limited',String(i).padStart(3,'0')+'.txt'),i===0?'hello':'z'.repeat(8193));
  const {operationId}=await h.engine.search({mode,predicate:'Fixture?',scope:{paths:['limited']},run:{maxRequests:1}}),p=h.results.page({...all,operationId}).value;
  assert.equal(p.coverage.initial.judged,1);assert.equal(p.coverage.initial.pending,0);assert.equal(p.complete,false);assert.equal(p.stopReason,'scope_limit');assert.equal(p.continuation.canResume,false);assert.equal(p.coverage.enumeration.remainingCandidates,null);
  await h.engine.continue({operationId,expectedIdentity:p.identity,run:{}});assert.equal(h.fake.calls.length,1);assert.equal(h.results.page({...all,operationId}).value.stopReason,'scope_limit');
});

}
