import test from 'node:test';
import assert from 'node:assert/strict';
import { Check } from 'typebox/value';
import { parseFilter, parsePolicy, parseSemanticResults, parseSemanticContinue, parseEvidence } from '../dist/semantic/validation.js';
import { filterSchema, semanticResultsSchema, semanticContinueSchema, evidenceInputSchema, semanticEnvelopeSchema,
  evidenceEnvelopeSchema, recordItemSchema } from '../dist/semantic/schemas.js';
import { canonicalJson } from '../dist/core/validation.js';
const hash='0'.repeat(64), filter=()=>({records:[{id:'a',text:''}],predicate:'supported?'});
const invalid=fn=>assert.throws(fn,{code:'invalid_input'});

test('record operations are closed, pure, copied, and reject search fields',()=>{
  const examples=[ [filterSchema,parseFilter,filter()],
    [semanticResultsSchema,parseSemanticResults,{operationId:'sem-a',policy:{version:1,minMatchProbability:0.8},limit:100}],
    [semanticContinueSchema,parseSemanticContinue,{operationId:'sem-a',expectedIdentity:hash,run:{},retryFailedEvidenceIds:[]}],
    [evidenceInputSchema,parseEvidence,{operationId:'sem-a',evidenceIds:['a'],checkCurrent:true}] ];
  for(const [schema,parse,input] of examples){
    assert.equal(Check(schema,parse(input)),true); assert.deepEqual(parse(input),input); assert.notEqual(parse(input),input);
    for(const key of ['unknown','scope','mode']) invalid(()=>parse({...input,[key]:1}));
    if(parse!==parseSemanticContinue)invalid(()=>parse({...input,targetMatches:1}));
    else {assert.equal(parse({...input,targetMatches:1}).targetMatches,1);invalid(()=>parse({...input,targetMatches:0}));}
  }
  const source=filter(); source.records[0].provenance={path:'C:/outside/.ssh/id_rsa',startLine:1,endLine:99};
  const copy=parseFilter(source); copy.records[0].provenance.path='mutated';
  assert.equal(source.records[0].provenance.path,'C:/outside/.ssh/id_rsa');
  for(const malformed of [null,{},[],{...filter(),records:[]},{...filter(),predicate:''}]) invalid(()=>parseFilter(malformed));
  invalid(()=>parseFilter({...filter(),records:[{id:'a',text:'',extra:1}]}));
  invalid(()=>parseFilter({...filter(),run:{extra:1}}));
});

test('atomic record count/identifier/text/predicate bounds use UTF-8 bytes',()=>{
  for(const n of [1,128]) assert.equal(parseFilter({...filter(),records:Array.from({length:n},(_,i)=>({id:String(i),text:''}))}).records.length,n);
  invalid(()=>parseFilter({...filter(),records:Array.from({length:129},(_,i)=>({id:String(i),text:''}))}));
  invalid(()=>parseFilter({...filter(),records:[{id:'a',text:'ok'},{id:'a',text:'later duplicate'}]}));
  for(const [field,size,char] of [['id',128,'x'],['id',128,'😀'],['text',16384,'x'],['text',16384,'😀']]){
    const good=char.repeat(size/Buffer.byteLength(char)); const input=filter(); input.records[0][field]=good;
    assert.equal(parseFilter(input).records[0][field],good); input.records[0][field]+='x'; invalid(()=>parseFilter(input));
  }
  for(const char of ['x','😀']){ const good=char.repeat(2048/Buffer.byteLength(char));
    assert.equal(parseFilter({...filter(),predicate:good}).predicate,good); invalid(()=>parseFilter({...filter(),predicate:good+'x'})); }
  invalid(()=>parseFilter({...filter(),records:[{id:'',text:''}]}));
});

test('canonical full submission boundary and malformed Unicode/unsafe objects reject before admission',()=>{
  const input={predicate:'p',records:Array.from({length:64},(_,i)=>({id:String(i),text:'x'.repeat(16384)}))};
  const excess=Buffer.byteLength(canonicalJson(input,2**21))-1048576;
  input.records[63].text=input.records[63].text.slice(excess);
  assert.equal(Buffer.byteLength(canonicalJson(input)),1048576); parseFilter(input);
  input.records[63].text+='x'; invalid(()=>parseFilter(input));
  for(const bad of ['\ud800','\udfff']){
    invalid(()=>parseFilter({...filter(),predicate:bad}));
    invalid(()=>parseFilter({...filter(),records:[{id:'a',text:bad}]}));
    invalid(()=>parseFilter({...filter(),records:[{id:bad,text:''}]}));
    invalid(()=>parseFilter({...filter(),records:[{id:'a',text:'',provenance:{path:bad}}]}));
  }
  let invoked=0; const getter=filter(); Object.defineProperty(getter,'predicate',{get(){invoked++;return 'p';},enumerable:true});
  invalid(()=>parseFilter(getter)); assert.equal(invoked,0);
  invalid(()=>parseFilter({...filter(),run:{maxRequests:Infinity}}));
});

test('provenance is bounded and requires paired safe positive ordered endpoints',()=>{
  const parse=p=>parseFilter({...filter(),records:[{id:'a',text:'',provenance:p}]});
  for(const p of [{},{label:'',path:''},{startLine:1,endLine:1},{startLine:1,endLine:Number.MAX_SAFE_INTEGER}]) parse(p);
  for(const field of ['label','path']){parse({[field]:'😀'.repeat(128)});invalid(()=>parse({[field]:'😀'.repeat(128)+'x'}));}
  for(const p of [{unknown:1},{startLine:1},{endLine:1},{startLine:2,endLine:1},{startLine:0,endLine:1},
    {startLine:1.5,endLine:2},{startLine:1,endLine:Number.MAX_SAFE_INTEGER+1},{path:null}]) invalid(()=>parse(p));
});

test('policy and result cursors/limits reject nonfinite, unsafe and oversized values',()=>{
  for(const cutoff of [0,0.8,1]) assert.equal(parsePolicy({version:1,minMatchProbability:cutoff}).minMatchProbability,cutoff);
  for(const cutoff of [-0.1,1.1,NaN,Infinity,'0']) invalid(()=>parsePolicy({version:1,minMatchProbability:cutoff}));
  invalid(()=>parsePolicy({version:2,minMatchProbability:0})); invalid(()=>parsePolicy({version:1,minMatchProbability:0,x:1}));
  for(const limit of [1,100]) parseSemanticResults({operationId:'s',limit});
  for(const limit of [0,101,1.5]) invalid(()=>parseSemanticResults({operationId:'s',limit}));
  parseSemanticResults({operationId:'s',cursor:'😀'.repeat(128)});
  for(const cursor of ['', '😀'.repeat(128)+'x']) invalid(()=>parseSemanticResults({operationId:'s',cursor}));
  invalid(()=>parseSemanticResults({operationId:'😀'.repeat(33)}));
});

test('continuation/evidence selectors and numeric limits are fully validated without touching evidence',()=>{
  const continuation={operationId:'s',expectedIdentity:hash,run:{}};
  for(const n of [0,128]) parseSemanticContinue({...continuation,retryFailedEvidenceIds:Array.from({length:n},(_,i)=>String(i))});
  for(const list of [['a','a'],['😀'.repeat(33)],Array.from({length:129},(_,i)=>String(i))]) invalid(()=>parseSemanticContinue({...continuation,retryFailedEvidenceIds:list}));
  for(const badHash of ['a'.repeat(63),'A'.repeat(64),'z'.repeat(64)]) invalid(()=>parseSemanticContinue({...continuation,expectedIdentity:badHash}));
  invalid(()=>parseSemanticContinue({operationId:'s',expectedIdentity:hash}));
  const evidence={operationId:'s',evidenceIds:['a']};
  parseEvidence({...evidence,evidenceIds:Array.from({length:20},(_,i)=>String(i)),startOffsetLines:Number.MAX_SAFE_INTEGER,maxLines:100,maxBytes:16384});
  parseEvidence({...evidence,startOffsetLines:0,maxLines:1,maxBytes:1});
  for(const list of [[],['a','a'],['😀'.repeat(33)],Array.from({length:21},(_,i)=>String(i))]) invalid(()=>parseEvidence({...evidence,evidenceIds:list}));
  for(const [key,values] of Object.entries({startOffsetLines:[-1,0.5,Number.MAX_SAFE_INTEGER+1],maxLines:[0,101,1.5],maxBytes:[0,16385,1.5],checkCurrent:['true']}))
    for(const value of values) invalid(()=>parseEvidence({...evidence,[key]:value}));
});

test('closed record result schemas preserve raw answers and prohibit fabricated file attribution/expansion',()=>{
  const model={provider:'fake',id:'fake',api:'fake',configurationFingerprint:hash,backendVersionKnown:false};
  const snippet={evidenceId:'e',path:null,startLine:null,endLine:null,text:'',textHash:hash,format:'plain',truncated:false,nextOffsetLines:null,freshness:'unverified'};
  const item={evidence:{evidenceId:'e',preparationVersion:'windows-v1',textHash:hash,inputVersion:hash,kind:'record',recordId:'a',verification:'unverified',provenance:null},
    snippet,attempts:1,expansion:{state:'none',evidence:null,attempts:0,error:null},status:'judged',
    raw:{judgmentId:'j',origin:'provider',answer:{type:'choice',choice:'match',probabilities:{match:0.8,no_match:0.1,insufficient_context:0.1},confidence:0.8},model,rubricVersion:'semantic-v1'},
    expanded:null,outcome:'match',reason:null};
  assert.equal(Check(recordItemSchema,item),true);
  for(const patch of [{snippet:{...snippet,path:'caller.txt'}},{snippet:{...snippet,freshness:'unchanged'}},{expanded:item.raw},
    {expansion:{state:'pending',evidence:null,attempts:0,error:null}},{raw:{...item.raw,answer:{...item.raw.answer,choice:'yes'}}},{extra:1}])
    assert.equal(Check(recordItemSchema,{...item,...patch}),false);
  const pending={evidence:item.evidence,snippet,attempts:0,expansion:item.expansion,status:'pending'};
  assert.equal(Check(recordItemSchema,pending),true);
  assert.equal(Check(recordItemSchema,{...pending,status:'failed',error:{code:'provider_error',retryEligible:false}}),true);
  const page={operationId:'sem-a',kind:'filter',identity:hash,revision:0,viewIdentity:hash,model,rubricVersion:'semantic-v1',preparationVersion:'windows-v1',
    policy:{version:1,minMatchProbability:0},policyIdentity:hash,mode:'filter',targetMatches:null,stopPolicy:null,state:'complete',stopReason:'complete',items:[item],
    coverage:{enumeration:{complete:true,candidatesSeen:1,remainingCandidates:0},files:{captured:0,excluded:0},initial:{total:1,judged:1,failed:0,pending:0,running:0},
      expanded:{pending:0,running:0,complete:0,failed:0,unavailable:0},excludedRanges:0,exclusions:[],exclusionCounts:[],exclusionsTruncated:false},
    outcomeCounts:{match:1,noMatch:0,unresolved:0},complete:true,continuation:{canResume:false,reason:null},page:{nextCursor:null,truncated:false},
    diagnostics:{attempts:1,cacheHits:0,elapsedMs:1,unknownUsageAttempts:1},usage:[],
    ledger:{grantedRequests:1,chargedRequests:1,remainingRequests:0,grantedInputBytes:100,chargedInputBytes:100,remainingInputBytes:0,unknownAttempts:1}};
  assert.equal(Check(semanticEnvelopeSchema,{ok:true,value:page}),true);
  for(const key of Object.keys(page)){const missing={...page}; delete missing[key];assert.equal(Check(semanticEnvelopeSchema,{ok:true,value:missing}),false,key);}
  const error={code:'disabled',message:'disabled'};
  assert.equal(Check(semanticEnvelopeSchema,{ok:false,error,partial:page}),true);
  assert.equal(Check(semanticEnvelopeSchema,{ok:false,error,batch:page}),false);
  assert.equal(Check(evidenceEnvelopeSchema,{ok:true,value:{operationId:'s',revision:0,snippets:[snippet],truncated:false}}),true);
  assert.equal(Check(evidenceEnvelopeSchema,{ok:false,error}),true);
  assert.equal(Check(evidenceEnvelopeSchema,{ok:false,error,partial:page}),false);
});
