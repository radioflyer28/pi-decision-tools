import test from 'node:test';
import assert from 'node:assert/strict';
import { ResultPages, sumUsage, recordUsage } from '../dist/core/results.js';
import { Workspaces } from '../dist/core/workspaces.js';
import { pinModel } from '../dist/core/controls.js';
import { fakeUsage } from './helpers/fixtures.mjs';
const totals={grantedRequests:0,chargedRequests:0,remainingRequests:0,grantedInputBytes:0,chargedInputBytes:0,remainingInputBytes:0,unknownAttempts:0};
const pin=pinModel({provider:'fake',id:'fixture',api:'fake'});
function batch(){return new Workspaces().prepare({items:Array.from({length:25},(_,i)=>({id:String(i),inputVersion:'1',state:{}})),
  rubricVersion:'v1',questions:{q:{type:'bool',instructions:'Fixture?',criteria:{true:'yes',false:'no'}}}},pin);}

test('EX-33 pages preserve order, return isolated snapshots, and use authenticated revision cursors',()=>{
  const pages=new ResultPages(),b=batch();const first=pages.page(b,totals);
  assert.equal(first.items.length,20);assert.equal(first.page.truncated,true);assert.equal(first.counts.total,25);
  const cursor=first.page.nextCursor;assert.ok(cursor.length<=128);
  const second=pages.page(b,totals,cursor);assert.equal(second.items[0].id,'20');assert.equal(second.items.length,5);
  assert.equal(second.page.nextCursor,null);first.items[0].attempts=100;assert.equal(b.outcomes[0].attempts,0);
  assert.throws(()=>pages.page(batch(),totals,cursor),{code:'cursor_invalid'});
  const forged=cursor.replace('.0.','.1.');assert.throws(()=>pages.page(b,totals,forged),{code:'cursor_invalid'});
  b.revision++;assert.throws(()=>pages.page(b,totals,cursor),{code:'cursor_stale'});
  const newCursor=pages.page(b,totals).page.nextCursor;assert.notEqual(cursor,newCursor);
  assert.equal(pages.page(b,totals,newCursor).items.length,5);
});

test('EX-33 output byte cap includes metadata and error envelope, not only item payload',()=>{
  const pages=new ResultPages(),b=batch();
  b.outcomes=b.outcomes.slice(0,3).map(o=>({...o,status:'completed',answers:{payload:'x'.repeat(65500)},abstainedQuestionIds:[],origin:'provider',judgmentId:'j'}));
  const error={code:'storage_error',message:'storage_error'};
  const page=pages.page(b,totals,undefined,20,error);
  assert.equal(page.items.length,1);assert.equal(page.page.truncated,true);
  assert.ok(Buffer.byteLength(JSON.stringify({ok:false,error,batch:page}))<=131072);
  b.busy=true;assert.throws(()=>pages.page(b,totals),{code:'batch_busy'});
});

test('EX-12 complete-with-failures remains distinct from output truncation',()=>{
  const pages=new ResultPages(),b=batch();b.stopReason='complete';
  b.outcomes=b.outcomes.map(o=>({...o,status:'failed',error:{code:'provider_error',retryEligible:false}}));
  const page=pages.page(b,totals);assert.equal(page.state,'complete');assert.equal(page.counts.failed,25);
  assert.equal(page.page.truncated,true);
});

test('EX-31/32 usage sums optional fields once, keeps unknown pricing, and does not fabricate unknown usage',()=>{
  const usage={...fakeUsage(),reasoning:2,cacheWrite1h:1};const sum=sumUsage(fakeUsage(),usage);
  assert.equal(sum.totalTokens,20);assert.equal(sum.reasoning,2);assert.equal(sum.cacheWrite1h,1);
  const groups=[];recordUsage(groups,'fake','a',null,'unknown');assert.equal(groups[0].usage,null);
  recordUsage(groups,'fake','a',usage,'known');recordUsage(groups,'fake','b',fakeUsage(),'known');
  assert.equal(groups.length,2);assert.equal(groups[0].pricing,'unknown');assert.deepEqual(groups[0].usage,usage);
  recordUsage(groups,'fake','a',fakeUsage(),'known');assert.equal(groups[0].usage.totalTokens,20);
});
