import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {relativePath,relativePaths,withinPath} from '../dist/core/relative-path.js';
import {parseScope,exclusionFor,ordinalPaths} from '../dist/filesystem/policy.js';
import {UserConfiguration,defaultConfiguration} from '../dist/pi/config.js';
import {parseConfiguration} from '../dist/core/validation.js';
import {FileEvidenceCapturer} from '../dist/filesystem/capture.js';
import {RetainedMemory} from '../dist/core/memory.js';
import {temporaryFixture} from './helpers/fixtures.mjs';

test('SM-18 closed atomic scope rejects hostile syntax and normalizes safe paths',()=>{
  for(const path of ['../x','a/../x','/root','\\\\host\\x','C:x','x:y','x\0y','x*','x?','x[0]','\ud800','.', ''])
    assert.throws(()=>parseScope({paths:['good',path]}),{code:'scope_invalid'});
  for(const input of [{paths:[]},{paths:['x','./x']},{paths:Array.from({length:257},(_,i)=>String(i))},{root:'outside'},{paths:['a'],run:{}}])
    assert.throws(()=>parseScope(input),{code:'scope_invalid'});
  assert.throws(()=>parseScope({get paths(){throw Error('getter');}}),{code:'scope_invalid'});
  assert.deepEqual(parseScope({paths:['./src//a','src\\b']}),{paths:['src/a','src/b']});
  assert.equal(relativePath('é'.repeat(2048),false).length,2048);assert.throws(()=>relativePath('é'.repeat(2049),false));
  const original={paths:['a']},copy=parseScope(original);original.paths[0]='b';assert.equal(copy.paths[0],'a');
});

test('SM-18 platform alias, Windows device and component-boundary rules',()=>{
  for(const value of ['NUL','con.txt','a/LPT1','COM¹.log','file.','file ','a|b','x<y','a\u0001'])assert.throws(()=>relativePath(value,true));
  assert.throws(()=>relativePaths(['a','A'],false,true));assert.deepEqual(relativePaths(['a','A'],false,false),['a','A']);
  assert.equal(withinPath('src/a','src',false),true);assert.equal(withinPath('src-old/a','src',false),false);
  assert.equal(withinPath('SRC/a','src',true),true);assert.equal(withinPath('SRC/a','src',false),false);
  assert.deepEqual(ordinalPaths(['é','z','a']),['a','z','é']);
});

test('SM-19 exact independent built-in exclusions and additive user prefixes',()=>{
  for(const p of ['.SSH/a','.AWS/a','.azure/a','.gnupg/a','credentials/a','secrets/a','.env','.env.example','.npmrc','.pypirc',
    'credentials.json','credentials.yml','credentials.yaml','secrets.json','secrets.yml','secrets.yaml','id_rsa','id_dsa','id_ecdsa','id_ed25519','a.PEM','a.key','a.p12','a.pfx'])assert.equal(exclusionFor(p),'sensitive',p);
  for(const p of ['node_modules/a','.git/a','vendor/a','dist/a','build/a','coverage/a','.venv/a','__pycache__/a','a.map',
    'package-lock.json','npm-shrinkwrap.json','yarn.lock','pnpm-lock.yaml','bun.lock','bun.lockb','poetry.lock','Pipfile.lock','Cargo.lock','go.sum'])assert.equal(exclusionFor(p),'dependency_generated',p);
  for(const p of ['secrets-old/a','credentials-old/a','my.node_modules/a','builds/a','foo.env','a.key.txt'])assert.equal(exclusionFor(p),null,p);
  assert.equal(exclusionFor('private/a',['private']),'user_excluded');assert.equal(exclusionFor('private-old/a',['private']),null);
  assert.equal(exclusionFor('secrets/a',['secrets']),'sensitive');
});

test('SM-20 additive configuration normalizes and survives atomic default saving',t=>{
  const f=temporaryFixture(t),store=new UserConfiguration(f.root);
  writeFileSync(store.path,JSON.stringify({...defaultConfiguration(),fileExclusions:['./private//docs','cache']}));
  const result=store.saveDefault({provider:'fake',id:'model'});
  assert.deepEqual(result.fileExclusions,['private/docs','cache']);assert.deepEqual(store.load(),result);assert.equal(result.enabled,undefined);
  for(const paths of [['../escape'],['a','./a'],['x'.repeat(4097)],Array(257).fill('x'),'x']){
    writeFileSync(store.path,JSON.stringify({...defaultConfiguration(),fileExclusions:paths}));assert.throws(()=>store.load(),{code:'invalid_configuration'});
  }
  writeFileSync(store.path,JSON.stringify({...defaultConfiguration(),fileExclusions:[]}));assert.deepEqual(store.load().fileExclusions,[]);
});

test('SM-18/19 maximum combined path bounds include JSON escaping without generic-submit truncation',()=>{
  const paths=Array.from({length:256},(_,i)=>'a'.repeat(4091)+String(i).padStart(5,'0'));
  assert.deepEqual(parseScope({paths}).paths,paths);
  assert.deepEqual(parseConfiguration({...defaultConfiguration(),fileExclusions:paths}).fileExclusions,paths);
  assert.doesNotThrow(()=>new FileEvidenceCapturer(process.cwd(),new RetainedMemory(),paths));
  const escaped=paths.map(p=>'\u0001'.repeat(4091)+p.slice(-5));
  assert.deepEqual(parseScope({paths:escaped},false).paths,escaped);
});
