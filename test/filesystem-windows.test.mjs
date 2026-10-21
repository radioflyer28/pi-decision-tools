import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareWindows,passageText,hashBytes} from '../dist/filesystem/windows.js';
const hash=b=>createHash('sha256').update(b).digest('hex');

test('SM-21 exact UTF-8 original bytes, BOM and line terminators',()=>{
  for(const text of ['', 'a\n','a\r\n','a\rb','\ufeffé\r\n\n尾','a\n\n','\ufeff']){
    const bytes=Buffer.from(text),p=prepareWindows(bytes);assert.equal(p.complete,true);assert.equal(hashBytes(bytes),hash(bytes));
    assert.equal(p.windows.length,text?1:0);
    if(text){const w=p.windows[0];assert.equal(w.startLine,1);assert.equal(w.endLine,text.split('\n').length-(text.endsWith('\n')?1:0));
      assert.equal(w.textHash,hash(bytes));assert.equal(passageText(bytes,w),text.replace(/^\ufeff/,''));}
  }
  for(const b of [Buffer.from([0xff]),Buffer.from([0xc0,0xaf]),Buffer.from([0xed,0xa0,0x80]),Buffer.from('a\0b')])assert.throws(()=>prepareWindows(b),{code:'binary_or_encoding'});
});

test('SM-22 greedy line and byte boundaries with overlap and no missing lines',()=>{
  const b=Buffer.from(Array.from({length:130},(_,i)=>i+'\r\n').join('')),p=prepareWindows(b);
  assert.deepEqual(p.windows.map(w=>[w.startLine,w.endLine]),[[1,64],[57,120],[113,130]]);
  for(const w of p.windows){assert.equal(w.textHash,hash(b.subarray(w.startByte,w.endByte)));assert.ok(w.endByte-w.startByte<=8192);}
  for(const size of [8191,8192]){const q=prepareWindows(Buffer.from('a'.repeat(size)));assert.equal(q.windows.length,1);assert.equal(q.excluded.length,0);}
  const multi=prepareWindows(Buffer.from(('é'.repeat(2047)+'\r\n').repeat(3)));
  assert.equal(multi.windows[0].endByte,8192);assert.equal(multi.windows[1].startLine,2);
});

test('SM-22 huge lines split regions without partial lines or repeated exclusions',()=>{
  const b=Buffer.from('before\n'+'x'.repeat(8193)+'\nafter\n'),p=prepareWindows(b);
  assert.deepEqual(p.excluded,[{startLine:2,endLine:2,reason:'line_too_large'}]);
  assert.deepEqual(p.windows.map(w=>[w.startLine,w.endLine]),[[1,1],[3,3]]);
  assert.deepEqual(p.windows.map(w=>passageText(b,w)),['before\n','after\n']);
  assert.equal(prepareWindows(Buffer.from('x'.repeat(8193))).windows.length,0);
});

test('SM-23 window count is bounded and completion distinguishes omitted work',()=>{
  const p=prepareWindows(Buffer.alloc(1024*1024,10));assert.equal(p.windows.length,2048);assert.equal(p.complete,false);
  assert.equal(prepareWindows(Buffer.from('a'),0).complete,false);assert.equal(prepareWindows(Buffer.alloc(0),0).complete,true);
  assert.throws(()=>prepareWindows(Buffer.alloc(1024*1024+1)),{code:'file_too_large'});
});
