import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export class FakeClock {
  now = 0;
  nextId = 0;
  timers = new Map();
  setTimeout = (fn, delay) => {
    const id = ++this.nextId;
    this.timers.set(id, { at: this.now + delay, fn });
    return id;
  };
  clearTimeout = id => { this.timers.delete(id); };
  advance(ms) {
    if (ms < 0) throw new Error('clock cannot rewind');
    const end = this.now + ms;
    for (;;) {
      const next = [...this.timers].filter(([, t]) => t.at <= end).sort((a,b) => a[1].at-b[1].at || a[0]-b[0])[0];
      if (!next) break;
      this.now = next[1].at; this.timers.delete(next[0]); next[1].fn();
    }
    this.now = end;
  }
}
export const fakeUsage = () => ({ input: 7, output: 3, cacheRead: 0, cacheWrite: 0,
  totalTokens: 10, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } });
export class FakeClassifier {
  calls = [];
  active = 0;
  peak = 0;
  actions = [];
  constructor(...actions) { this.actions.push(...actions); }
  classify = async (model, request, options = {}) => {
    const call = { model, request: structuredClone(request), options, aborted: options.signal?.aborted ?? false };
    this.calls.push(call); this.peak = Math.max(this.peak, ++this.active);
    const onAbort = () => { call.aborted = true; };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const action = this.actions.shift();
      if (action) return await action(call);
      return { api: model.api, provider: model.provider, model: model.id, stopReason: 'stop', timestamp: 0,
        answers: Object.fromEntries(Object.entries(request.questions).map(([key,q]) => [key,
          q.type === 'bool' ? { type: 'bool', probability: 0.75 } :
          q.type === 'score' ? { type: 'score', score: 0, confidence: 1 } :
          { type: 'choice', choice: Object.keys(q.criteria)[0], confidence: 1,
            probabilities: Object.fromEntries(Object.keys(q.criteria).map((k,i) => [k,i===0?1:0])) }
        ])), usage: fakeUsage() };
    } finally {
      this.active--; options.signal?.removeEventListener('abort', onAbort);
    }
  };
}
export function temporaryFixture(t) {
  if (!process.env.TEST_TEMP_ROOT) throw new Error('run fixtures through npm test');
  const root = mkdtempSync(join(process.env.TEST_TEMP_ROOT, 'fixture-'));
  const sessions = join(root,'sessions'); mkdirSync(sessions);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, sessions, configPath: join(root,'decision-tools.json'), authPath: join(root,'auth.json') };
}
export function fakeSession(sessionId = 'fixture-session') {
  const entries = [];
  return { sessionId, entries, getEntries: () => structuredClone(entries),
    append(customType, data) { entries.push({ type:'custom', id:String(entries.length), customType, data:structuredClone(data) }); } };
}
