import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,unlinkSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {Check} from 'typebox/value';
import {evidenceEnvelopeSchema} from '../dist/semantic/schemas.js';
import {createHash} from 'node:crypto';
import {deferred} from './helpers/fixtures.mjs';
import {searchFixture} from './helpers/search.mjs';

for(const mode of ['systematic','discovery']) {
const test=(name,fn)=>nodeTest(`${mode}: ${name}`,fn);
const all=mode==='discovery'?{view:'all'}:{};
test('current-file checks report changes without replacing captured text or spending',async t=>{
  const {f,engine,results,fake,ledger}=await searchFixture(t);const path=join(f.root,'a.txt');writeFileSync(path,'hello');
  const {operationId}=await engine.search({mode,predicate:'Greeting?',scope:{paths:['a.txt']}});
  const page=results.page({operationId,...all}).value,request={operationId,evidenceIds:[page.items[0].evidence.evidenceId],checkCurrent:true};
  writeFileSync(path,'different');const changed=await results.evidence(request);
  assert.equal(changed.ok,true);assert.equal(Check(evidenceEnvelopeSchema,changed),true);
  assert.equal(changed.value.snippets[0].freshness,'changed');assert.equal(changed.value.snippets[0].text,'hello');
  assert.equal(changed.value.snippets[0].textHash,'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  unlinkSync(path);assert.equal((await results.evidence(request)).value.snippets[0].freshness,'missing');
  assert.equal((await results.evidence({...request,checkCurrent:false})).value.snippets[0].freshness,'captured');
  assert.equal(fake.calls.length,0);assert.equal(ledger.snapshot().totals.chargedRequests,0);assert.equal(results.page({operationId}).value.revision,page.revision);
});

test('current-source read holds its parent lease until expiry drains the real read',async t=>{
  let armed=false;const entered=deferred(),finish=deferred();
  const {f,engine,results,core}=await searchFixture(t,{hooks:{beforeOpen:async()=>{if(armed){entered.resolve();await finish.promise;}}}});
  writeFileSync(join(f.root,'a.txt'),'hello');const {operationId}=await engine.search({mode,predicate:'Greeting?',scope:{paths:['a.txt']}});
  const page=results.page({operationId,...all}).value;armed=true;let ended=false,ending,read;
  const running=results.evidence({operationId,evidenceIds:[page.items[0].evidence.evidenceId],checkCurrent:true});
  try{
    await entered.promise;assert.equal(results.page({operationId}).error.code,'search_busy');
    assert.throws(()=>engine.parents.release(operationId),{code:'search_busy'});
    await assert.rejects(engine.continue({operationId,expectedIdentity:page.identity,run:{}}),{code:'search_busy'});
    ending=engine.expire().then(()=>{ended=true;},error=>{ended=true;return error.code;});
    await new Promise(resolve=>setImmediate(resolve));assert.equal(ended,false,'expiry must drain the owned evidence read');
  }finally{finish.resolve();read=await running;if(ending)assert.equal(await ending,undefined);}
  assert.equal(read.error.code,'search_expired');assert.equal(results.page({operationId}).error.code,'search_expired');
  assert.equal(core.memory.retainedBytes,0);assert.equal(core.memory.reservedBytes,0);
});

test('file snippets preserve BOM/CRLF/Unicode byte hashes and bounded line offsets',async t=>{
  const {f,engine,results,fake}=await searchFixture(t);const bytes=Buffer.from('\uFEFFé\r\n世界\r\nlast');writeFileSync(join(f.root,'a.txt'),bytes);
  const {operationId}=await engine.search({mode,predicate:'Fixture?',scope:{paths:['a.txt']}}),p=results.page({operationId,...all}).value;
  const id=p.items[0].evidence.evidenceId,hash=b=>createHash('sha256').update(b).digest('hex');
  assert.equal(p.items[0].evidence.fileHash,hash(bytes));assert.equal(p.items[0].evidence.textHash,hash(bytes));
  const first=(await results.evidence({operationId,evidenceIds:[id],maxLines:1,maxBytes:7})).value.snippets[0];
  assert.equal(first.text,'é\r\n');assert.equal(first.textHash,hash(bytes.subarray(0,7)));assert.equal(first.startLine,1);assert.equal(first.endLine,1);assert.equal(first.nextOffsetLines,1);assert.equal(first.truncated,true);
  const rest=(await results.evidence({operationId,evidenceIds:[id],startOffsetLines:1,maxLines:2,maxBytes:12})).value.snippets[0];
  assert.equal(rest.text,'世界\r\nlast');assert.equal(rest.textHash,hash(bytes.subarray(7)));assert.equal(rest.startLine,2);assert.equal(rest.endLine,3);assert.equal(rest.truncated,false);assert.equal(rest.nextOffsetLines,null);
  const empty=(await results.evidence({operationId,evidenceIds:[id],startOffsetLines:99})).value.snippets[0];assert.equal(empty.text,'');assert.equal(empty.startLine,null);assert.equal(empty.endLine,null);assert.equal(empty.textHash,hash(Buffer.alloc(0)));
  writeFileSync(join(f.root,'a.txt'),Buffer.from([0xff]));const current=(await results.evidence({operationId,evidenceIds:[id],checkCurrent:true})).value.snippets[0];
  assert.equal(current.freshness,'changed');assert.equal(current.text,'é\r\n世界\r\nlast');assert.equal(current.format,'plain');
  unlinkSync(join(f.root,'a.txt'));mkdirSync(join(f.root,'a.txt'));
  assert.equal((await results.evidence({operationId,evidenceIds:[id],checkCurrent:true})).value.snippets[0].freshness,'unverifiable');assert.equal(fake.calls.length,0);
});

test('record provenance cannot acquire current-file authority',async t=>{
  let reads=0;const {f,engine,results,fake}=await searchFixture(t,{hooks:{beforeOpen:async()=>{reads++;}}});writeFileSync(join(f.root,'a.txt'),'not record evidence');
  const {operationId}=await engine.filter({predicate:'Fixture?',records:[{id:'a',text:'caller record',provenance:{path:'a.txt',startLine:1,endLine:1}}]});
  const p=results.page({operationId}).value,snippet=(await results.evidence({operationId,evidenceIds:[p.items[0].evidence.evidenceId],checkCurrent:true})).value.snippets[0];
  assert.equal(snippet.freshness,'unverified');assert.equal(snippet.text,'caller record');assert.equal(snippet.path,null);assert.equal(reads,0);assert.equal(fake.calls.length,0);
});

for(const trigger of ['caller','disable'])test(`${trigger} cancels owned current-file reads but drains before releasing the lease`,async t=>{
  let armed=false;const entered=deferred(),finish=deferred();
  const h=await searchFixture(t,{hooks:{beforeOpen:async()=>{if(armed){entered.resolve();await finish.promise;}}}});writeFileSync(join(h.f.root,'a.txt'),'hello');
  const {operationId}=await h.engine.search({mode,predicate:'Fixture?',scope:{paths:['a.txt']}}),p=h.results.page({operationId,...all}).value;
  const abort=new AbortController();armed=true;let ended=false;
  const running=Promise.resolve(h.results.evidence({operationId,evidenceIds:[p.items[0].evidence.evidenceId],checkCurrent:true},{signal:abort.signal})).then(r=>{ended=true;return r;});
  await entered.promise;
  try{if(trigger==='caller')abort.abort('untrusted reason');else h.engine.pause();await new Promise(resolve=>setImmediate(resolve));assert.equal(ended,false);assert.throws(()=>h.engine.parents.release(operationId),{code:'search_busy'});}
  finally{finish.resolve();}
  const result=await running;assert.equal(result.ok,false);assert.equal(result.error.code,trigger==='caller'?'cancelled':'disabled');
  assert.equal(h.results.page({operationId}).value.revision,p.revision);assert.equal(h.fake.calls.length,0);armed=false;
  assert.equal((await h.results.evidence({operationId,evidenceIds:[p.items[0].evidence.evidenceId],checkCurrent:true})).value.snippets[0].freshness,'unchanged');
});

}
