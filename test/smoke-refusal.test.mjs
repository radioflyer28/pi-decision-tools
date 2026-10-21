import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('../scripts/native-smoke.mjs',import.meta.url));
test('native smoke refuses before loading credentials/providers without explicit consent, model and finite budget',()=>{
  for(const [args,reason] of [[[],'authorization_required'],[['--authorize-live'],'model_and_budget_required'],
    [['--authorize-live','--model','fake/model','--budget','{}'],'invalid_budget'],
    [['--authorize-live','--model','fake','--budget','{}'],'exact_model_required']]){
    const child=spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:5000});
    assert.equal(child.status,2,child.stderr);const report=JSON.parse(child.stdout);
    assert.equal(report.status,'not_run');assert.equal(report.reason,reason);assert.ok(report.syntheticInput);
  }
});

test('native smoke with explicit consent still refuses a catalog classifier without credentials',async()=>{
  const {ModelRuntime}=await import('@earendil-works/pi-coding-agent');
  const runtime=await ModelRuntime.create({refreshOnCreate:false,allowModelNetwork:false});
  const model=runtime.getModelsOfType('classifier').find(m=>!runtime.hasConfiguredAuth(m.provider));
  assert.ok(model,'The installed Pi catalog must supply a classifier for the missing-credential refusal test');
  const budget={requests:1,inputBytes:4096,concurrency:1,maxWorkMs:10000,maxAttemptMs:5000,maxRetries:0};
  const child=spawnSync(process.execPath,[script,'--authorize-live','--model',`${model.provider}/${model.id}`,'--budget',JSON.stringify(budget)],
    {encoding:'utf8',timeout:10000});
  assert.equal(child.status,2,child.stderr+child.stdout);
  const report=JSON.parse(child.stdout);assert.equal(report.status,'not_run');
  assert.equal(report.reason,'model_unavailable_or_missing_credentials');
});
