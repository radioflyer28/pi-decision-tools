import test from 'node:test';
import assert from 'node:assert/strict';
import { Check } from 'typebox/value';
import { submitSchema, resultsSchema, continueSchema, envelopeSchema } from '../dist/pi/schemas.js';
import { parseSubmit, parseContinue, parseResults } from '../dist/core/validation.js';

test('structural input schemas agree with validated JSON examples', () => {
  for(const [schema,parse,input] of [
    [submitSchema,parseSubmit,{items:[{id:'a',inputVersion:'1',state:{arbitrary:{x:[null,true,1]}}}],rubricVersion:'v1',
      questions:{q:{type:'bool',instructions:'Does evidence support it?',criteria:{true:'Yes',false:'No'}}},run:{maxRequests:0}}],
    [resultsSchema,parseResults,{batchId:'b',limit:20}],
    [continueSchema,parseContinue,{batchId:'b',expectedIdentity:'identity',run:{maxRequests:1},retryFailedIds:['a']}]
  ]) {
    assert.equal(Check(schema,parse(input)),true);
    assert.equal(Check(schema,{...input,unexpected:true}),false);
  }
});

test('output schema describes typed envelopes rather than prose or permissive unknown output', () => {
  const page={batchId:'b',identity:'identity',rubricVersion:'v1',
    model:{provider:'fake',id:'fixture',api:'fake',configurationFingerprint:'f',backendVersionKnown:false},
    state:'partial', counts:{total:2,completed:1,failed:0,pending:1,running:0},stopReason:'call_limit',
    items:[{id:'a',inputVersion:'1',status:'completed',attempts:1,answers:{q:{type:'bool',probability:0.75}},
      abstainedQuestionIds:[],origin:'provider',judgmentId:'j'},{id:'b',inputVersion:'1',status:'pending',attempts:0}],
    page:{nextCursor:null,truncated:false},diagnostics:{attempts:1,cacheHits:0,elapsedMs:1,unknownUsageAttempts:1},usage:[],
    ledger:{grantedRequests:3,chargedRequests:1,remainingRequests:2,grantedInputBytes:300,chargedInputBytes:100,remainingInputBytes:200,unknownAttempts:1}};
  assert.equal(Check(envelopeSchema,{ok:true,value:page}),true);
  assert.equal(Check(envelopeSchema,{ok:false,error:{code:'disabled',message:'disabled'},batch:page}),true);
  assert.equal(Check(envelopeSchema,{ok:false,error:{code:'disabled',message:'disabled'}}),true);
  assert.equal(Check(envelopeSchema,{ok:true,value:'rendered prose'}),false);
  assert.equal(Check(envelopeSchema,{ok:true,value:{...page,missing:'unknown field'}}),false);
  page.items[0].answers.q.probability=2;
  assert.equal(Check(envelopeSchema,{ok:true,value:page}),false);
});
