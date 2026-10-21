import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {searchFixture} from './helpers/search.mjs';
import {fakeUsage} from './helpers/fixtures.mjs';

// Operational scripts, NOT a relevance benchmark: every judgment is predetermined.
const distributions={
  dense:i=>'match',sparse:i=>i%6===0?'match':'no_match',late:i=>i>=24?'match':'no_match',
  absent:i=>'no_match',insufficient:i=>'insufficient_context',belowCutoff:i=>'weak',
  failed:i=>i%8===0?'failed':'no_match',overlap:i=>'match',
};
const native=label=>async()=>({api:'fake',provider:'fake',model:'fixture',timestamp:0,
  stopReason:label==='failed'?'error':'stop',...(label==='failed'?{}:{usage:fakeUsage()}),
  answers:label==='failed'?{}:{relevance:{type:'choice',choice:label==='weak'?'match':label,confidence:1,
    probabilities:{match:label==='match'?1:label==='weak'?0.5:0,no_match:label==='no_match'?1:label==='weak'?0.5:0,insufficient_context:label==='insufficient_context'?1:0}}}});
function spans(items){
  const ranges=items.map(i=>({path:i.evidence.path,start:i.evidence.startLine,end:i.evidence.endLine})).sort((a,b)=>a.path.localeCompare(b.path)||a.start-b.start),merged=[];
  for(const r of ranges){const last=merged.at(-1);if(last&&last.path===r.path&&r.start<=last.end+1)last.end=Math.max(last.end,r.end);else merged.push({...r});}
  return {mergedSourceSpans:merged.length,coveredSourceLines:merged.reduce((n,r)=>n+r.end-r.start+1,0)};
}
for(const [name,label] of Object.entries(distributions))test(`offline paired ${name} operational comparison`,async t=>{
  const metrics=[];
  for(const mode of ['systematic','discovery']){
    const n=name==='overlap'?16:32,h=await searchFixture(t,{limits:{requests:100,inputBytes:1048576,concurrency:1,maxRetries:0,maxWorkMs:10000},actions:Array.from({length:n},(_,i)=>native(label(i)))});
    writeFileSync(join(h.f.root,'fixture.txt'),'synthetic fixture\n'.repeat(64+56*(n-1)));
    const started=performance.now(),created=await h.engine.search({mode,predicate:'Synthetic predetermined relevance?',scope:{paths:['fixture.txt']},policy:{version:1,minMatchProbability:0.8},...(mode==='discovery'?{targetMatches:5}:{}),run:{maxRequests:64}});
    let handoffs=0,returnedEnvelopeBytes=0,newEvidenceBytes=0,repeatedEvidenceBytes=0,first,priorCalls=0,allMatches=[];const emittedIds=new Set();
    while(true){
      let cursor,items=[],p,bytes=0;do{const response=h.results.page({operationId:created.operationId,limit:100,...(cursor?{cursor}:{})});assert.equal(response.ok,true,JSON.stringify(response));p=response.value;items.push(...p.items);bytes+=Buffer.byteLength(JSON.stringify(response));cursor=p.page.nextCursor;}while(cursor);
      const matches=items.filter(i=>i.outcome==='match');allMatches.push(...matches);handoffs++;returnedEnvelopeBytes+=bytes;
      for(const item of matches){const bytes=Buffer.byteLength(JSON.stringify({id:item.evidence.evidenceId,source:{path:item.evidence.path,startLine:item.evidence.startLine,endLine:item.evidence.endLine},snippet:item.snippet}));if(emittedIds.has(item.evidence.evidenceId))repeatedEvidenceBytes+=bytes;else newEvidenceBytes+=bytes;emittedIds.add(item.evidence.evidenceId);}
      if(!first)first={chargedInputBytes:p.ledger.chargedInputBytes,classifierCalls:h.fake.calls.length-priorCalls,usefulEvidenceIds:matches.length,...spans(matches),returnedItems:items.length,toolEnvelopeBytes:bytes,controllerEmittedEvidenceBytes:Buffer.byteLength(JSON.stringify(matches.map(i=>({id:i.evidence.evidenceId,source:{path:i.evidence.path,startLine:i.evidence.startLine,endLine:i.evidence.endLine},snippet:i.snippet})))),latencyMs:Math.round(performance.now()-started)};
      priorCalls=h.fake.calls.length;if(p.complete)break;
      assert.ok(handoffs<=8,'bounded fixture must progress');await h.engine.continue({operationId:created.operationId,expectedIdentity:p.identity,run:{maxRequests:64}});
    }
    assert.equal(h.fake.calls.length,n);const final=h.results.page({operationId:created.operationId,...(mode==='discovery'?{view:'all'}:{})}).value;
    const expected=Array.from({length:n},(_,i)=>label(i)).filter(l=>l==='match').length;assert.equal(new Set(allMatches.map(i=>i.evidence.evidenceId)).size,expected);
    assert.equal(repeatedEvidenceBytes,0);assert.ok(Number.isSafeInteger(first.chargedInputBytes));
    metrics.push({mode,first,exhaustive:{classifierCalls:h.fake.calls.length,chargedInputBytes:final.ledger.chargedInputBytes,handoffProxy:handoffs,returnedEnvelopeBytes,newEvidenceBytes,repeatedEvidenceBytes,elapsedMs:Math.round(performance.now()-started),knownFakeTokens:final.usage.reduce((sum,u)=>sum+u.usage.totalTokens,0),unknownUsageRequests:final.ledger.unknownAttempts},actualLlmTurns:null,realTotalCost:null,semanticTaskSuccess:null});
  }
  if(name==='dense'||name==='overlap'){assert.equal(metrics[1].first.classifierCalls,8);assert.ok(metrics[0].first.classifierCalls>8);assert.ok(metrics[1].exhaustive.handoffProxy>metrics[0].exhaustive.handoffProxy);}
  else assert.equal(metrics[1].first.classifierCalls,32,'weak/late/absent runs must not cause early yielding');
  console.log('DISCOVERY_OPERATIONAL '+JSON.stringify({fixture:name,synthetic:true,budget:{maxRequests:64,requests:100,inputBytes:1048576},metrics}));
});
