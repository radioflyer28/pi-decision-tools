import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, copyJson, identity, jsonBytes, parseSubmit, parseAnswers,
  parseContinue, parseResults, parseRun, parseLimits, parseConfiguration, DEFAULT_LIMITS,
  BOUNDS } from '../dist/core/validation.js';

const bool = {type:'bool', instructions:'Is the evidence affirmative?', criteria:{true:'Yes',false:'No'}};
const choice = {type:'choice', instructions:'Select the supported label', criteria:{yes:'Yes',no:'No',unknown:'Insufficient evidence'}};
const score = {type:'score', instructions:'Assess urgency', criteria:['none','soon','now']};
const submit = () => ({items:[{id:'a',inputVersion:'1',state:{text:'evidence'}}],rubricVersion:'v1',questions:{q:structuredClone(bool)}});
const invalid = fn => assert.throws(fn, {code:'invalid_input'});

test('canonical JSON sorts keys, preserves arrays, shares safely, and hashes by content', () => {
  assert.equal(canonicalJson({z:[2,1],a:{y:false,x:null}}), '{"a":{"x":null,"y":false},"z":[2,1]}');
  assert.equal(identity({a:1,b:2}), identity({b:2,a:1}));
  assert.notEqual(identity([1,2]), identity([2,1]));
  const shared = {a:1};
  assert.equal(canonicalJson([shared,shared]), '[{"a":1},{"a":1}]');
  assert.equal(jsonBytes('😀'), 6);
  assert.equal(canonicalJson(-0), '0');
});

test('EX-10 JSON copying rejects unsafe values without executing getters or toJSON', () => {
  for(const value of [undefined, NaN, Infinity, 1n, Symbol('x'), () => 1, new Date(), new Map(), new Number(1)]) invalid(() => copyJson(value));
  let accessed = 0;
  const getter = Object.defineProperty({}, 'x', {enumerable:true,get(){accessed++;return 1;}});
  invalid(() => copyJson(getter));
  invalid(() => copyJson({toJSON(){accessed++;return {};}}));
  invalid(() => copyJson(Object.create({x:1})));
  invalid(() => copyJson(Object.defineProperty({},'secret',{value:1})));
  invalid(() => copyJson({[Symbol('x')]:1}));
  assert.equal(accessed,0);
});

test('EX-10 cycles, sparse arrays, custom array fields and malformed surrogate sequences fail', () => {
  const cycle={}; cycle.self=cycle;
  invalid(() => copyJson(cycle));
  invalid(() => copyJson(new Array(2)));
  invalid(() => copyJson(Object.assign([1],{x:2})));
  for(const text of ['\ud800','\udfff','a\ud800x']) invalid(() => copyJson(text));
  invalid(() => copyJson({['\ud800']:1}));
  assert.equal(copyJson('a😀b'),'a😀b');
});

test('deep legal JSON does not recurse on the JS stack', () => {
  let value=0; for(let i=0;i<10000;i++) value=[value];
  const encoded=canonicalJson(value);
  assert.equal(encoded.length,20001);
  assert.ok(Array.isArray(copyJson(value)));
});

test('EX-10 prototype-looking keys are inert data', () => {
  const value=JSON.parse('{"__proto__":{"polluted":true},"constructor":1,"prototype":2}');
  const copy=copyJson(value);
  assert.equal(Object.getPrototypeOf(copy),Object.prototype);
  assert.ok(Object.hasOwn(copy,'__proto__'));
  assert.equal({}.polluted,undefined);
  assert.equal(copy.__proto__.polluted,true);
});

test('EX-10 byte caps are UTF-8 based with exact boundaries', () => {
  assert.equal(canonicalJson('😀',6),'"😀"');
  invalid(() => canonicalJson('😀',5));
  const request=submit(); request.items[0].id='é'.repeat(64);
  assert.equal(parseSubmit(request).items[0].id.length,64);
  request.items[0].id+='é'; invalid(() => parseSubmit(request));
});

test('EX-10/14 valid submission is copied and caller mutation cannot change it', () => {
  const request=submit(); const result=parseSubmit(request);
  request.items[0].state.text='changed'; request.questions.q.instructions='changed';
  assert.equal(result.items[0].state.text,'evidence');
  assert.equal(result.questions.q.instructions,bool.instructions);
  assert.equal(result.run,undefined);
});

test('EX-10 submission rejects unknown shape, empty bodies, duplicate IDs and bad versions', () => {
  for(const change of [r=>r.extra=true,r=>r.items=[],r=>r.items.push(structuredClone(r.items[0])),
    r=>r.items[0].state=[],r=>r.items[0].inputVersion='',r=>r.rubricVersion='',
    r=>r.items[0].extra=1,r=>r.questions={},r=>r.items[0].state={x:undefined}]) {
    const r=submit(); change(r); invalid(() => parseSubmit(r));
  }
});

test('EX-10 item count and questions count enforce maximums', () => {
  const r=submit(); r.items=Array.from({length:128},(_,i)=>({...r.items[0],id:String(i)}));
  assert.equal(parseSubmit(r).items.length,128);
  r.items.push({...r.items[0],id:'overflow'}); invalid(() => parseSubmit(r));
  const q=submit(); q.questions=Object.fromEntries(Array.from({length:16},(_,i)=>[String(i),bool]));
  assert.equal(Object.keys(parseSubmit(q).questions).length,16);
  q.questions.extra=bool; invalid(() => parseSubmit(q));
});

test('EX-10 item and submission byte limits include repeated questions', () => {
  const r=submit(); r.items[0].state.text='x'.repeat(BOUNDS.itemBytes);
  invalid(() => parseSubmit(r));
  const many=submit(); many.items=Array.from({length:30},(_,i)=>({id:String(i),inputVersion:'1',state:{text:'x'.repeat(40000)}}));
  invalid(() => parseSubmit(many));
});

test('EX-11 explicit choice abstention is validated separately from bool/score', () => {
  const r=submit(); r.questions={c:choice,b:bool,s:score}; r.abstainChoices={c:['unknown']};
  assert.deepEqual(parseSubmit(r).abstainChoices,{c:['unknown']});
  for(const policy of [{b:['true']},{s:['0']},{missing:['unknown']},{c:['bad']},{c:['unknown','unknown']}]) {
    r.abstainChoices=policy; invalid(() => parseSubmit(r));
  }
});

test('EX-10 questions require exact native criteria and descriptions', () => {
  const bad=[{...bool,type:'other'},{...bool,criteria:{true:'Yes'}},{...bool,criteria:{true:'Yes',false:'No',extra:'X'}},
    {...score,criteria:['one']},{...score,criteria:Array(33).fill('x')},{...choice,criteria:{only:'One'}},
    {...bool,instructions:''},{...bool,instructions:0},{...bool,criteria:{true:'',false:'No'}}];
  for(const q of bad){const r=submit();r.questions.q=q;invalid(() => parseSubmit(r));}
});

test('EX-16 all valid native answer types retain exact semantics', () => {
  const answers={b:{type:'bool',probability:0.7},s:{type:'score',score:1.25,confidence:0.8},
    c:{type:'choice',choice:'unknown',probabilities:{yes:0.1,no:0.2,unknown:0.7},confidence:0.7}};
  assert.deepEqual(parseAnswers(answers,{b:bool,s:score,c:choice}),answers);
});

test('EX-16 invalid native answers fail closed with sanitized code', () => {
  const candidates=[{}, {b:{type:'bool',probability:NaN}}, {b:{type:'bool',probability:2}},
    {b:{type:'bool',probability:0.5,secret:'PRIVATE'}},{b:{type:'score',score:0,confidence:1}},
    {b:{type:'bool',probability:0.5},extra:{type:'bool',probability:0.5}}];
  for(const answer of candidates) assert.throws(() => parseAnswers(answer,{b:bool}),{code:'invalid_response',message:'invalid_response'});
  for(const answer of [{type:'score',score:3,confidence:0.5},{type:'score',score:1,confidence:-1}])
    assert.throws(() => parseAnswers({s:answer},{s:score}),{code:'invalid_response'});
  for(const answer of [
    {type:'choice',choice:'bad',confidence:0.5,probabilities:{yes:1,no:0,unknown:0}},
    {type:'choice',choice:'yes',confidence:0.5,probabilities:{yes:1,no:0}},
    {type:'choice',choice:'yes',confidence:0.5,probabilities:{yes:1,no:1,unknown:0}}])
    assert.throws(() => parseAnswers({c:answer},{c:choice}),{code:'invalid_response'});
});

test('EX-14/19 continuation rejects changing inputs and invalid retry IDs', () => {
  const request={batchId:'b',expectedIdentity:'i',run:{maxRequests:0},retryFailedIds:['a']};
  assert.deepEqual(parseContinue(request),request);
  invalid(() => parseContinue({...request,items:[]}));
  invalid(() => parseContinue({...request,retryFailedIds:['a','a']}));
  invalid(() => parseContinue({...request,retryFailedIds:['']}));
  invalid(() => parseContinue({...request,run:{maxWorkMs:0}}));
});

test('EX-33 result page arguments are bounded and exact', () => {
  assert.deepEqual(parseResults({batchId:'b'}),{batchId:'b'});
  assert.deepEqual(parseResults({batchId:'b',cursor:'c',limit:100}),{batchId:'b',cursor:'c',limit:100});
  for(const limit of [0,101,-1,1.5,NaN]) invalid(() => parseResults({batchId:'b',limit}));
  invalid(() => parseResults({batchId:'b',run:{}}));
});

test('EX-23 lower run caps are nonnegative safe integers', () => {
  assert.deepEqual(parseRun({maxRequests:0,maxInputBytes:0,maxWorkMs:1}),{maxRequests:0,maxInputBytes:0,maxWorkMs:1});
  for(const r of [{requests:1},{maxRequests:-1},{maxInputBytes:Number.MAX_SAFE_INTEGER+1},{maxWorkMs:0}]) invalid(() => parseRun(r));
  assert.deepEqual(parseLimits(DEFAULT_LIMITS),DEFAULT_LIMITS);
  for(const limits of [{...DEFAULT_LIMITS,concurrency:9},{...DEFAULT_LIMITS,maxRetries:3},
    {...DEFAULT_LIMITS,maxAttemptMs:10001},{...DEFAULT_LIMITS,maxWorkMs:60001}]) invalid(() => parseLimits(limits));
});

test('EX-38 configuration cannot store enabled state or unknown versions', () => {
  const config={version:1,families:{generic:true,semantic:false},limits:{...DEFAULT_LIMITS}};
  assert.deepEqual(parseConfiguration(config),config);
  invalid(() => parseConfiguration({...config,enabled:true}));
  invalid(() => parseConfiguration({...config,version:2}));
  invalid(() => parseConfiguration({...config,families:{generic:true,semantic:'false'}}));
});
