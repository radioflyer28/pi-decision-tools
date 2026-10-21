import test from 'node:test';
import assert from 'node:assert/strict';
import { Check } from 'typebox/value';
import { SemanticParents } from '../dist/semantic/parents.js';
import { SemanticResults } from '../dist/semantic/results.js';
import { prepareFilter } from '../dist/semantic/preparation.js';
import { RetainedMemory } from '../dist/core/memory.js';
import { jsonBytes } from '../dist/core/validation.js';
import { semanticEnvelopeSchema,evidenceEnvelopeSchema } from '../dist/semantic/schemas.js';
const model={provider:'fake',id:'fixture',api:'fake',configurationFingerprint:'f',backendVersionKnown:false};
function setup(n=10,text='record',pin=model){
  const ledger={grantedRequests:100,chargedRequests:0,remainingRequests:100,grantedInputBytes:1048576,chargedInputBytes:0,remainingInputBytes:1048576,unknownAttempts:0};
  const parents=new SemanticParents({memory:new RetainedMemory(),controls:{ledger:{snapshot:()=>({totals:ledger})}}});
  const p=parents.admit(prepareFilter({predicate:'Supported?',records:Array.from({length:n},(_,i)=>({id:String(i),text,provenance:{path:'C:/outside/.ssh/id_rsa'}}))},pin));
  return {parents,p,results:new SemanticResults(parents)};
}
function judge(parents,p,n=p.outcomes.length){
  const outcomes=p.outcomes.map((o,i)=>i<n?{...o,status:'completed',attempts:1,answers:{relevance:{type:'choice',choice:i%3===0?'match':i%3===1?'no_match':'insufficient_context',probabilities:{match:0.8,no_match:0.1,insufficient_context:0.1},confidence:0.8}},abstainedQuestionIds:i%3===2?['relevance']:[],origin:'provider',judgmentId:`j-${i}`}:o);
  parents.update(p.id,{outcomes,stopReason:n===p.outcomes.length?'complete':'call_limit'});
}
const good=r=>{assert.equal(r.ok,true,JSON.stringify(r));assert.equal(Check(semanticEnvelopeSchema,r),true);return r.value;};

test('prepared and completed-child/incomplete-parent pages carry all partitions and bounded captured snippets',()=>{
  const {parents,p,results}=setup();const prepared=good(results.page({operationId:p.id}));
  assert.equal(prepared.state,'prepared');assert.equal(prepared.coverage.initial.pending,10);assert.equal(prepared.complete,false);
  judge(parents,p,8);const page=good(results.page({operationId:p.id}));
  assert.deepEqual(page.coverage.initial,{total:10,judged:8,failed:0,pending:2,running:0});assert.equal(page.complete,false);
  assert.equal(Object.values(page.outcomeCounts).reduce((a,b)=>a+b),8);assert.equal(page.continuation.canResume,true);
  assert.equal(page.coverage.enumeration.complete,true);assert.equal(page.items[0].snippet.path,null);assert.equal(page.items[0].evidence.verification,'unverified');
  const partial=results.page({operationId:p.id},'storage_error');assert.equal(Check(semanticEnvelopeSchema,partial),true);assert.equal(partial.partial.coverage.initial.judged,8);
});

test('fixed-revision pagination has no gaps, parallel cutoff views do not mutate answers or each other',()=>{
  const {parents,p,results}=setup(128);judge(parents,p);const policy={version:1,minMatchProbability:0.9};
  const defaultPage=good(results.page({operationId:p.id,limit:7})),alternate=good(results.page({operationId:p.id,limit:7,policy}));
  assert.ok(defaultPage.outcomeCounts.match>0);assert.equal(alternate.outcomeCounts.match,0);assert.equal(alternate.items[0].reason,'below_cutoff');
  assert.deepEqual(defaultPage.items[0].raw.answer,alternate.items[0].raw.answer);
  const ids=[];let cursor;
  do{const page=good(results.page({operationId:p.id,limit:7,policy,...(cursor?{cursor}:{})}));ids.push(...page.items.map(i=>i.evidence.recordId));cursor=page.page.nextCursor;}while(cursor);
  assert.deepEqual(ids,Array.from({length:128},(_,i)=>String(i)));
  assert.equal(good(results.page({operationId:p.id,limit:7,cursor:defaultPage.page.nextCursor})).items[0].evidence.recordId,'7');
  alternate.items[0].raw.answer.probabilities.match=0;alternate.model.id='changed';alternate.policy.minMatchProbability=0;
  assert.equal(good(results.page({operationId:p.id})).items[0].raw.answer.probabilities.match,0.8);assert.equal(p.prepared.model.id,'fixture');
});

test('cursor authentication rejects tampering, wrong view/limit/parent/runtime and stale revisions',()=>{
  const {parents,p,results}=setup();const cursor=good(results.page({operationId:p.id,limit:1})).page.nextCursor;
  for(const request of [{cursor:cursor+'x',limit:1},{cursor,limit:2},{cursor,limit:1,policy:{version:1,minMatchProbability:1}}])
    assert.equal(results.page({operationId:p.id,...request}).error.code,'cursor_invalid');
  assert.equal(new SemanticResults(parents).page({operationId:p.id,limit:1,cursor}).error.code,'cursor_invalid');
  const other=parents.admit(prepareFilter({predicate:'x',records:[{id:'a',text:''}]},model));
  assert.equal(results.page({operationId:other.id,limit:1,cursor}).error.code,'cursor_invalid');
  parents.acquire(p.id);assert.equal(results.page({operationId:p.id}).error.code,'search_busy');parents.finish(p.id);
  assert.equal(results.page({operationId:p.id,limit:1,cursor}).error.code,'cursor_stale');
  parents.release(p.id);assert.equal(results.page({operationId:p.id}).error.code,'search_expired');
});

test('whole envelope limits yield advancing pages or explicit output_limit, never dropped raw data',()=>{
  const {parents,p,results}=setup(100,'x'.repeat(2000));judge(parents,p);
  const first=good(results.page({operationId:p.id,limit:100}));assert.ok(first.items.length>0&&first.items.length<100);assert.equal(first.page.truncated,true);
  const ids=first.items.map(i=>i.evidence.recordId);let cursor=first.page.nextCursor;
  while(cursor){const next=good(results.page({operationId:p.id,limit:100,cursor}));ids.push(...next.items.map(i=>i.evidence.recordId));cursor=next.page.nextCursor;}
  assert.deepEqual(ids,Array.from({length:100},(_,i)=>String(i)));
  assert.ok(jsonBytes({ok:true,value:first},Number.MAX_SAFE_INTEGER)<=131072);
  const huge=setup(1,'',{...model,id:'x'.repeat(140000)});assert.equal(huge.results.page({operationId:huge.p.id}).error.code,'output_limit');
});

test('captured evidence validates the entire selection, ignores claimed file authority and caps the whole envelope',()=>{
  const {parents,p,results}=setup(20,'x'.repeat(16384));const ids=p.prepared.records.map(r=>r.evidence.evidenceId);
  const first=results.evidence({operationId:p.id,evidenceIds:[ids[0]],checkCurrent:true});assert.equal(Check(evidenceEnvelopeSchema,first),true);
  assert.equal(first.value.snippets[0].text,'');assert.equal(first.value.snippets[0].nextOffsetLines,0);assert.equal(first.value.snippets[0].freshness,'unverified');
  assert.equal(first.value.snippets[0].path,null);assert.equal(first.value.truncated,true);
  const full=results.evidence({operationId:p.id,evidenceIds:[ids[0]],maxBytes:16384});assert.equal(full.value.snippets[0].text.length,16384);
  assert.equal(results.evidence({operationId:p.id,evidenceIds:ids,maxBytes:16384}).error.code,'output_limit');
  assert.equal(results.evidence({operationId:p.id,evidenceIds:[ids[0],'unknown']}).error.code,'invalid_input');
  parents.acquire(p.id);assert.equal(results.evidence({operationId:p.id,evidenceIds:[ids[0]]}).error.code,'search_busy');parents.finish(p.id);
  parents.release(p.id);assert.equal(results.evidence({operationId:p.id,evidenceIds:[ids[0]]}).error.code,'search_expired');
});
