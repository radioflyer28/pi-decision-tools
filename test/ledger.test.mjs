import test from 'node:test';
import assert from 'node:assert/strict';
import { LEDGER_TYPE, replayLedger, parseUsage } from '../dist/core/ledger.js';
import { DEFAULT_LIMITS } from '../dist/core/validation.js';
import { fakeUsage } from './helpers/fixtures.mjs';
const policy={...DEFAULT_LIMITS,requests:3,inputBytes:300};
const grant={kind:'grant',requests:3,inputBytes:300,policy,initial:true};
const reserve=(attemptId='a',inputBytes=100)=>({kind:'reserve',attemptId,requests:1,inputBytes,provider:'fake',model:'fixture'});
const settle=(attemptId='a',usage=null)=>({kind:'settle',attemptId,outcome:'answered',usage,pricing:'unknown'});
const release=(attemptId='a')=>({kind:'release',attemptId,reason:'not_dispatched'});
const entries=(...payloads)=>payloads.map((p,i)=>({type:'custom',customType:LEDGER_TYPE,data:{version:1,eventId:`e${i}`,sessionId:'s',sequence:i+1,...p}}));
const replay=(...payloads)=>replayLedger(entries(...payloads),'s');
const fails=fn=>assert.throws(fn,{code:'storage_error',message:'storage_error'});

test('EX-24/25 empty or unrelated history does not create allowance',()=>{
  assert.equal(replay().policy,null);
  const result=replayLedger([{type:'message',message:{role:'user'}},{type:'custom',customType:'unrelated',data:{}}],'s');
  assert.equal(result.totals.grantedRequests,0);
});

test('EX-24/30 unresolved crash reservation stays charged across replay',()=>{
  const result=replay(grant,reserve());
  assert.deepEqual(result.totals,{grantedRequests:3,chargedRequests:1,remainingRequests:2,
    grantedInputBytes:300,chargedInputBytes:100,remainingInputBytes:200,unknownAttempts:1});
  assert.equal(result.attempts.get('a').status,'reserved');
  assert.deepEqual(replayLedger(entries(grant,reserve()),'s').totals,result.totals);
});

test('EX-25 physical all-branch order ignores parent links and navigation entries',()=>{
  const history=entries(grant,reserve('a'),reserve('b'));
  history[1].parentId='old-message';history[2].parentId='other-branch';
  history.push({type:'message',parentId:null,message:{role:'user',content:'branch'}});
  assert.equal(replayLedger(history,'s').totals.remainingRequests,1);
  history.push({...entries(reserve('c'))[0],data:{...entries(reserve('c'))[0].data,sequence:4,eventId:'e4'}});
  assert.equal(replayLedger(history,'s').totals.remainingRequests,0);
});

test('EX-27 replenish adds allowance without reset, policy change, or reinitialization',()=>{
  const result=replay(grant,reserve(),{...grant,initial:false,requests:2,inputBytes:200});
  assert.equal(result.totals.grantedRequests,5);assert.equal(result.totals.chargedRequests,1);
  assert.equal(result.totals.unknownAttempts,1);
  fails(()=>replay({...grant,initial:false}));
  fails(()=>replay(grant,grant));
  fails(()=>replay(grant,{...grant,initial:false,policy:{...policy,concurrency:3}}));
  fails(()=>replay({...grant,requests:2}));
});

test('EX-30 known and unknown settlement never refunds liability',()=>{
  for(const outcome of ['answered','failed','aborted']){
    const known=replay(grant,reserve(),{...settle('a',fakeUsage()),outcome});
    assert.equal(known.totals.chargedRequests,1);assert.equal(known.totals.unknownAttempts,0);
    const unknown=replay(grant,reserve(),{...settle(),outcome});
    assert.equal(unknown.totals.chargedInputBytes,100);assert.equal(unknown.totals.unknownAttempts,1);
  }
});

test('EX-29/30 release only consumes an unsettled reservation and restores exact charge',()=>{
  const result=replay(grant,reserve(),release());
  assert.equal(result.totals.remainingRequests,3);assert.equal(result.totals.remainingInputBytes,300);
  assert.equal(result.totals.unknownAttempts,0);
  for(const seq of [[release()],[settle()],[reserve(),settle(),release()],
    [reserve(),release(),release()],[reserve(),release(),settle()],[reserve(),settle(),settle()],
    [reserve(),reserve()]]) fails(()=>replay(grant,...seq));
  fails(()=>replay(grant,reserve(),{...release(),reason:'probably_not_dispatched'}));
});

test('EX-24 foreign-session inheritance including future versions grants nothing',()=>{
  const inherited=entries(grant,reserve());
  assert.equal(replayLedger(inherited,'fork').totals.grantedRequests,0);
  inherited[0].customType='pi-decision-tools.ledger.v99';inherited[0].data.version=99;
  assert.equal(replayLedger(inherited,'fork').totals.chargedRequests,0);
  fails(()=>replayLedger(inherited,'s'));
});

test('EX-24 unknown versions and missing ownership fail closed',()=>{
  for(const customType of [LEDGER_TYPE,'pi-decision-tools.ledger.v2','pi-decision-tools.ledger']){
    const history=entries(grant);history[0].customType=customType;history[0].data.version=2;
    fails(()=>replayLedger(history,'s'));
  }
  for(const data of [null,{},[],{sessionId:''}]) fails(()=>replayLedger([{type:'custom',customType:LEDGER_TYPE,data}],'s'));
});

test('EX-24 duplicate event/attempt IDs, nonmonotonic sequences and unsafe counters fail',()=>{
  const history=entries(grant,reserve());
  history[1].data.eventId='e0';fails(()=>replayLedger(history,'s'));
  history[1].data.eventId='e1';history[1].data.sequence=1;fails(()=>replayLedger(history,'s'));
  history[1].data.sequence=10;assert.equal(replayLedger(history,'s').sequence,10);
  for(const value of [-1,NaN,Infinity,0.5,Number.MAX_SAFE_INTEGER+1]) fails(()=>replay({...grant,requests:value}));
  fails(()=>replay(grant,{...grant,initial:false,requests:Number.MAX_SAFE_INTEGER}));
  fails(()=>replay(grant,{...grant,initial:false,inputBytes:Number.MAX_SAFE_INTEGER}));
});

test('EX-24 reservations cannot exceed either independent allowance',()=>{
  fails(()=>replay(grant,reserve('a',301)));
  fails(()=>replay(grant,reserve('a',0),reserve('b',0),reserve('c',0),reserve('d',0)));
  fails(()=>replay(reserve()));
});

test('EX-35 unexpected private fields are rejected rather than persisted or surfaced',()=>{
  fails(()=>replay({...grant,state:{secret:'PRIVATE'}}));
  fails(()=>replay(grant,{...reserve(),itemId:'PRIVATE'}));
  fails(()=>replay(grant,reserve(),{...settle(),error:'PRIVATE'}));
  const data=entries(grant,reserve());const state=replayLedger(data,'s');data[0].data.policy.requests=99;
  assert.equal(state.policy.requests,3);
});

test('usage preserves optional native counters and rejects malformed values',()=>{
  const usage={...fakeUsage(),reasoning:1,cacheWrite1h:0};
  assert.deepEqual(parseUsage(usage),usage);
  for(const u of [{...usage,input:-1},{...usage,cost:{...usage.cost,total:NaN}},
    {...usage,unexpected:1}]) assert.throws(()=>parseUsage(u));
  fails(()=>replay(grant,reserve(),settle('a',{...usage,input:-1})));
});
