import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';
import { parseConfiguration, parseSubmit, parseContinue, parseLimits } from '../dist/core/validation.js';
import { parseSearch, parseFilter, parseSemanticResults, parseSemanticContinue, parseEvidence } from '../dist/semantic/validation.js';
import { temporaryFixture } from './helpers/fixtures.mjs';
const usage=readFileSync(new URL('../docs/usage.md',import.meta.url),'utf8');
test('documented generic JSON examples satisfy runtime validators',()=>{
  const examples=[...usage.matchAll(/```json\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1]));
  assert.equal(examples.length,3);assert.doesNotThrow(()=>parseConfiguration(examples[0]));
  assert.doesNotThrow(()=>parseSubmit(examples[1]));assert.doesNotThrow(()=>parseContinue(examples[2]));
  const smoke=readFileSync(new URL('../docs/native-smoke.md',import.meta.url),'utf8');
  const budget=JSON.parse(smoke.match(/--budget '(\{[^\n]+\})'/)[1]);assert.doesNotThrow(()=>parseLimits(budget));
  assert.equal(budget.requests,1);assert.equal(budget.maxRetries,0);
});
test('documented library example typechecks against emitted public declarations',t=>{
  const f=temporaryFixture(t),source=join(f.root,'example.mts');
  const snippet=usage.match(/```typescript\n([\s\S]*?)\n```/)[1];
  writeFileSync(source,`import type {DiscoveryHost,ConnectionContext} from 'pi-decision-tools';\ndeclare const pi:DiscoveryHost;declare const ctx:ConnectionContext;\ndeclare const input:unknown;declare const signal:AbortSignal|undefined;\n${snippet}`);
  const program=ts.createProgram([source],{noEmit:true,strict:true,exactOptionalPropertyTypes:true,skipLibCheck:true,
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[],
    baseUrl:process.cwd(),paths:{'pi-decision-tools':['dist/index.d.ts']}});
  const diagnostics=ts.getPreEmitDiagnostics(program);assert.equal(diagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(diagnostics,
    {getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:p=>p,getNewLine:()=> '\n'}));
});
test('reader entrypoint and operator documentation relative links exist',()=>{
  for(const file of ['README.md','docs/usage.md','docs/native-smoke.md','docs/verification.md','docs/semantic-usage.md','docs/semantic-verification.md','docs/semantic-contract.md','docs/semantic-acceptance.md','docs/development.md','docs/filesystem-evidence.md','docs/filesystem-verification.md','docs/search-usage.md','docs/search-verification.md']){
    const full=resolve(file),text=readFileSync(full,'utf8');
    for(const [,target] of text.matchAll(/\]\(([^)]+)\)/g)){
      if(/^(?:https?:|#)/.test(target))continue;
      assert.ok(existsSync(resolve(dirname(full),target.split('#')[0])),`${file}: ${target}`);
    }
  }
});

test('documented semantic examples satisfy each closed runtime input contract',()=>{
  const text=readFileSync(new URL('../docs/semantic-usage.md',import.meta.url),'utf8');
  const examples=[...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1]));
  assert.equal(examples.length,4);
  for(const [i,parse] of [parseFilter,parseSemanticResults,parseSemanticContinue,parseEvidence].entries())assert.doesNotThrow(()=>parse(examples[i]));
  const source=text.match(/```javascript\n([\s\S]*?)\n```/)[1];
  assert.doesNotThrow(()=>new (Object.getPrototypeOf(async function(){}).constructor)('tools',source));
});

test('documented filesystem exclusion configuration passes the closed runtime parser',()=>{
  const text=readFileSync(new URL('../docs/filesystem-evidence.md',import.meta.url),'utf8');
  const examples=[...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1]));
  assert.equal(examples.length,1);assert.deepEqual(parseConfiguration(examples[0]).fileExclusions,['private','notes/local.txt']);
});

test('documented search examples satisfy closed runtime contracts',()=>{
  const text=readFileSync(new URL('../docs/search-usage.md',import.meta.url),'utf8');
  const examples=[...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1]));assert.equal(examples.length,5);
  for(const [i,parse] of [parseSearch,parseSearch,parseSemanticContinue,parseSemanticResults,parseSemanticContinue].entries())assert.doesNotThrow(()=>parse(examples[i]));
});
