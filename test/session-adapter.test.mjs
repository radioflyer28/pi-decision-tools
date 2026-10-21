import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { SessionManager } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js';
import { SessionLedger } from '../dist/pi/session-adapter.js';
import { DEFAULT_LIMITS } from '../dist/core/validation.js';
import { LEDGER_TYPE } from '../dist/core/ledger.js';
import { temporaryFixture, fakeUsage } from './helpers/fixtures.mjs';
const policy={...DEFAULT_LIMITS,requests:3,inputBytes:300};
function setup(t, conversation=true) {
  const f=temporaryFixture(t), session=SessionManager.create(f.root,f.sessions);
  if(conversation) session.appendMessage({role:'user',content:'Synthetic persistence fixture.',timestamp:Date.now()});
  const append=(type,data)=>session.appendCustomEntry(type,data);
  return {...f,session,append,ledger:new SessionLedger(session,append)};
}
const initialize=l=>l.grant(policy.requests,policy.inputBytes,policy,true);
const denied=(fn,code='storage_error')=>assert.throws(fn,{code});

test('EX-05 custom-only real Pi sessions remain buffered and cannot grant',t=>{
  const {session,ledger}=setup(t,false);
  session.appendCustomEntry('fixture.setup',{synthetic:true});
  assert.equal(existsSync(session.getSessionFile()),false);
  denied(()=>initialize(ledger),'persistence_required');
  assert.equal(ledger.snapshot().events.length,0); assert.equal(ledger.faulted,false);
  session.appendMessage({role:'user',content:'Synthetic persisted message.',timestamp:Date.now()});
  initialize(ledger);assert.equal(ledger.read().totals.remainingRequests,3);
});

test('EX-05 nonpersistent sessions reject provider liability even with messages',t=>{
  const f=temporaryFixture(t),session=SessionManager.inMemory(f.root);
  session.appendMessage({role:'user',content:'Synthetic memory-only message.',timestamp:Date.now()});
  const ledger=new SessionLedger(session,(type,data)=>session.appendCustomEntry(type,data));
  denied(()=>initialize(ledger),'persistence_required');assert.equal(ledger.snapshot().events.length,0);
});

test('EX-28 reservations are visible on disk before dispatch; unknown settlement never refunds',t=>{
  const {session,ledger}=setup(t);initialize(ledger);
  const id=ledger.reserve(100,'fake','fixture');
  const disk=readFileSync(session.getSessionFile(),'utf8');
  assert.ok(disk.includes(id));assert.equal(ledger.read().totals.unknownAttempts,1);
  ledger.markDispatched(id);ledger.settle(id,'aborted',null,'unknown');
  assert.equal(ledger.read().totals.remainingRequests,2);assert.equal(ledger.read().totals.unknownAttempts,1);
});

test('EX-29 only this runtime can release a provably undispatched reservation',t=>{
  const {session,append,ledger}=setup(t);initialize(ledger);
  const id=ledger.reserve(100,'fake','fixture');
  const reopened=new SessionLedger(session,append);
  denied(()=>reopened.releaseUndispatched(id),'unproven_non_dispatch');
  ledger.releaseUndispatched(id);assert.equal(ledger.read().totals.remainingRequests,3);
  const started=ledger.reserve(100,'fake','fixture');ledger.markDispatched(started);
  denied(()=>ledger.releaseUndispatched(started),'unproven_non_dispatch');
  ledger.settle(started,'answered',fakeUsage(),'unknown');
  assert.equal(ledger.read().totals.unknownAttempts,0);
});

test('EX-24/25 reopening and navigating an older branch preserves all charges',t=>{
  const {session,ledger}=setup(t);const original=session.getLeafId();initialize(ledger);
  ledger.reserve(100,'fake','fixture');session.branch(original);
  assert.equal(session.getBranch().some(e=>e.customType===LEDGER_TYPE),false);
  assert.equal(ledger.read().totals.remainingRequests,2);
  const reopened=SessionManager.open(session.getSessionFile());
  const recovered=new SessionLedger(reopened,(type,data)=>reopened.appendCustomEntry(type,data));
  assert.equal(recovered.read().totals.remainingRequests,2);
  assert.equal(recovered.read().totals.unknownAttempts,1);
});

test('EX-28 missing initialized storage latches and restoration alone does not clear fault',t=>{
  const {session,ledger}=setup(t);initialize(ledger);
  const path=session.getSessionFile(),original=readFileSync(path,'utf8');rmSync(path);
  denied(()=>ledger.read());assert.equal(ledger.faulted,true);
  writeFileSync(path,original);denied(()=>ledger.read());
});

test('EX-28 buffered append and partial write failures cannot authorize dispatch',t=>{
  for(const failure of ['memory-only','append-then-throw','before-append']) {
    const {session,append,ledger}=setup(t);initialize(ledger);
    const badAppend=(type,data)=>{
      if(failure==='memory-only') {
        const path=session.getSessionFile(),original=readFileSync(path,'utf8');
        append(type,data);writeFileSync(path,original);
      } else if(failure==='append-then-throw'){append(type,data);throw new Error('PRIVATE');}
      else throw new Error('PRIVATE');
    };
    const broken=new SessionLedger(session,badAppend);
    denied(()=>broken.reserve(100,'fake','fixture'));
    assert.equal(broken.faulted,true);assert.equal(broken.snapshot().totals.chargedRequests,1);
    denied(()=>broken.read());
  }
});

test('EX-29 failed release read-back retains conservative reservation liability',t=>{
  const {session,append}=setup(t);
  let rejectRelease=false;
  const ledger=new SessionLedger(session,(type,data)=>{
    if(rejectRelease && data.kind==='release') throw new Error('fixture write failure');
    append(type,data);
  });
  initialize(ledger);const id=ledger.reserve(100,'fake','fixture');rejectRelease=true;
  denied(()=>ledger.releaseUndispatched(id));
  assert.equal(ledger.snapshot().totals.chargedRequests,1);
  const recovered=new SessionLedger(session,append);
  assert.equal(recovered.read().totals.chargedRequests,1);
});

test('EX-28 malformed file and wrong header fail without appending new liability',t=>{
  for(const content of ['{','{"type":"session","id":"wrong"}\n']) {
    const {session,ledger}=setup(t);initialize(ledger);
    writeFileSync(session.getSessionFile(),content);
    denied(()=>ledger.reserve(100,'fake','fixture'));
    assert.equal(ledger.snapshot().totals.chargedRequests,0);
  }
});

test('stale session adapter rejects replacement identity before any append',t=>{
  const {session,append}=setup(t);let identity=session.getSessionId();
  const access={getSessionId:()=>identity,getSessionFile:()=>session.getSessionFile(),getEntries:()=>session.getEntries()};
  const ledger=new SessionLedger(access,append);initialize(ledger);identity='replacement';
  denied(()=>ledger.reserve(100,'fake','fixture'));assert.equal(ledger.snapshot().totals.chargedRequests,0);
});
