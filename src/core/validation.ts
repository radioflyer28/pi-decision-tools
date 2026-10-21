import { createHash } from "node:crypto";
import type { Answer, Configuration, Continue, Json, Limits, Question, Results, Run, Submit } from "./contracts.js";
import { requireThat, ToolkitError } from "./errors.js";
import { relativePaths, PATH_JSON_BYTES } from "./relative-path.js";

export const BOUNDS = Object.freeze({ items: 128, questions: 16, criteria: 32, identifier: 128,
  itemBytes: 65_536, submitBytes: 1_048_576, answerBytes: 65_536, pageBytes: 131_072,
  batches: 32, workspaceBytes: 8_388_608 });
export const DEFAULT_LIMITS: Readonly<Limits> = Object.freeze({ requests: 100, inputBytes: 1_048_576,
  concurrency: 2, maxWorkMs: 10_000, maxAttemptMs: 5_000, maxRetries: 1 });

function wellFormed(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (c >= 0xdc00 && c <= 0xdfff) return false;
  }
  return true;
}

/** Iterative traversal avoids recursion overflow and never invokes a getter or toJSON. */
export function canonicalJson(input: unknown, maxBytes: number = BOUNDS.submitBytes): string {
  type Work = { kind: "value"; value: unknown } | { kind: "text"; text: string } | { kind: "leave"; value: object };
  const work: Work[] = [{ kind: "value", value: input }];
  const ancestors = new Set<object>();
  const parts: string[] = [];
  let bytes = 0;
  const write = (text: string) => {
    bytes += Buffer.byteLength(text, "utf8");
    requireThat(bytes <= maxBytes);
    parts.push(text);
  };
  while (work.length) {
    const task = work.pop()!;
    if (task.kind === "text") { write(task.text); continue; }
    if (task.kind === "leave") { ancestors.delete(task.value); continue; }
    const v = task.value;
    if (v === null || typeof v === "boolean") { write(String(v)); continue; }
    if (typeof v === "number") { requireThat(Number.isFinite(v)); write(JSON.stringify(v)); continue; }
    if (typeof v === "string") { requireThat(wellFormed(v)); write(JSON.stringify(v)); continue; }
    requireThat(typeof v === "object" && v !== null && !ancestors.has(v));
    const array = Array.isArray(v);
    const proto: unknown = Object.getPrototypeOf(v);
    requireThat(array ? proto === Array.prototype : proto === Object.prototype || proto === null);
    const keys = Reflect.ownKeys(v);
    requireThat(keys.every(key => typeof key === "string"));
    const names = keys as string[];
    const descriptors = Object.getOwnPropertyDescriptors(v);
    for (const key of names) {
      const descriptor = descriptors[key]!;
      requireThat("value" in descriptor && (array && key === "length" || descriptor.enumerable));
      requireThat(wellFormed(key));
    }
    ancestors.add(v);
    work.push({ kind: "leave", value: v });
    if (array) {
      requireThat(names.length === v.length + 1);
      for (let i = 0; i < v.length; i++) requireThat(Object.hasOwn(descriptors, String(i)));
      write("[");
      work.push({ kind: "text", text: "]" });
      for (let i = v.length - 1; i >= 0; i--) {
        work.push({ kind: "value", value: descriptors[String(i)]!.value });
        if (i) work.push({ kind: "text", text: "," });
      }
    } else {
      names.sort();
      write("{");
      work.push({ kind: "text", text: "}" });
      for (let i = names.length - 1; i >= 0; i--) {
        const key = names[i]!;
        work.push({ kind: "value", value: descriptors[key]!.value });
        work.push({ kind: "text", text: JSON.stringify(key) + ":" });
        if (i) work.push({ kind: "text", text: "," });
      }
    }
  }
  return parts.join("");
}
export function copyJson(input: unknown, maxBytes: number = BOUNDS.submitBytes): Json {
  return JSON.parse(canonicalJson(input, maxBytes)) as Json;
}
export function identity(input: unknown): string {
  // Identity wrappers add metadata around an already bounded submission.
  return createHash("sha256").update(canonicalJson(input, Number.MAX_SAFE_INTEGER)).digest("hex");
}
export function jsonBytes(input: unknown, maxBytes: number = BOUNDS.submitBytes): number {
  return Buffer.byteLength(canonicalJson(input, maxBytes), "utf8");
}
export function record(value: unknown): Record<string, unknown> {
  requireThat(typeof value === "object" && value !== null && !Array.isArray(value));
  return value as Record<string, unknown>;
}
export function exact(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  const obj = record(value);
  requireThat(required.every(k => Object.hasOwn(obj, k)) && Object.keys(obj).every(k => required.includes(k) || optional.includes(k)));
  return obj;
}
export function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  requireThat(typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max);
  return value;
}
export function identifier(value: unknown): string {
  requireThat(typeof value === "string" && value.length > 0 && wellFormed(value) && Buffer.byteLength(value) <= BOUNDS.identifier);
  return value;
}
function description(value: unknown): void { requireThat(typeof value === "string" && value.length > 0); }

export function parseRun(value: unknown): Run {
  const obj = exact(copyJson(value), [], ["maxRequests", "maxInputBytes", "maxWorkMs"]);
  for (const key of Object.keys(obj)) integer(obj[key], key === "maxWorkMs" ? 1 : 0);
  return obj as Run;
}
export function parseLimits(value: unknown): Limits {
  const obj = exact(copyJson(value), ["requests", "inputBytes", "concurrency", "maxWorkMs", "maxAttemptMs", "maxRetries"]);
  integer(obj.requests); integer(obj.inputBytes); integer(obj.concurrency, 1, 8);
  integer(obj.maxWorkMs, 1, 60_000); integer(obj.maxAttemptMs, 1, obj.maxWorkMs as number); integer(obj.maxRetries, 0, 2);
  return obj as unknown as Limits;
}
export function parseConfiguration(value: unknown): Configuration {
  const obj = exact(copyJson(value, PATH_JSON_BYTES), ["version", "families", "limits"], ["defaultModel", "fileExclusions"]);
  if (Object.hasOwn(obj, "fileExclusions")) obj.fileExclusions = relativePaths(obj.fileExclusions, true);
  requireThat(obj.version === 1);
  const families = exact(obj.families, ["generic", "semantic"]);
  requireThat(typeof families.generic === "boolean" && typeof families.semantic === "boolean");
  parseLimits(obj.limits);
  if (Object.hasOwn(obj, "defaultModel")) {
    const model = exact(obj.defaultModel, ["provider", "id"]);
    identifier(model.provider); description(model.id);
  }
  return obj as unknown as Configuration;
}
export function parseSubmit(value: unknown): Submit {
  const obj = exact(copyJson(value), ["items", "rubricVersion", "questions"], ["abstainChoices", "run"]);
  identifier(obj.rubricVersion);
  const questions = record(obj.questions);
  const qids = Object.keys(questions);
  requireThat(qids.length >= 1 && qids.length <= BOUNDS.questions);
  for (const id of qids) {
    identifier(id);
    const q = exact(questions[id], ["type", "instructions", "criteria"]);
    description(q.instructions);
    if (q.type === "score") {
      requireThat(Array.isArray(q.criteria) && q.criteria.length >= 2 && q.criteria.length <= BOUNDS.criteria);
      q.criteria.forEach(description);
    } else {
      requireThat(q.type === "bool" || q.type === "choice");
      const criteria = record(q.criteria);
      const keys = Object.keys(criteria);
      if (q.type === "bool") exact(criteria, ["true", "false"]);
      else requireThat(keys.length >= 2 && keys.length <= BOUNDS.criteria);
      for (const key of keys) { identifier(key); description(criteria[key]); }
    }
  }
  requireThat(Array.isArray(obj.items) && obj.items.length >= 1 && obj.items.length <= BOUNDS.items);
  const ids = new Set<string>();
  for (const raw of obj.items) {
    const item = exact(raw, ["id", "inputVersion", "state"]);
    const id = identifier(item.id); identifier(item.inputVersion); record(item.state);
    requireThat(!ids.has(id)); ids.add(id);
    jsonBytes({ state: item.state, questions }, BOUNDS.itemBytes);
  }
  if (Object.hasOwn(obj, "abstainChoices")) {
    for (const [id, labels] of Object.entries(record(obj.abstainChoices))) {
      requireThat(Object.hasOwn(questions, id));
      const question = questions[id] as Question;
      requireThat(question.type === "choice" && Array.isArray(labels));
      requireThat(labels.length === new Set(labels).size);
      for (const label of labels) requireThat(typeof label === "string" && Object.hasOwn(question.criteria, label));
    }
  }
  if (Object.hasOwn(obj, "run")) parseRun(obj.run);
  return obj as unknown as Submit;
}
export function parseResults(value: unknown): Results {
  const obj = exact(copyJson(value), ["batchId"], ["cursor", "limit"]);
  identifier(obj.batchId);
  if (Object.hasOwn(obj, "cursor")) identifier(obj.cursor);
  if (Object.hasOwn(obj, "limit")) integer(obj.limit, 1, 100);
  return obj as unknown as Results;
}
export function parseContinue(value: unknown): Continue {
  const obj = exact(copyJson(value), ["batchId", "expectedIdentity", "run"], ["retryFailedIds"]);
  identifier(obj.batchId); identifier(obj.expectedIdentity); parseRun(obj.run);
  if (Object.hasOwn(obj, "retryFailedIds")) {
    requireThat(Array.isArray(obj.retryFailedIds) && obj.retryFailedIds.length <= BOUNDS.items);
    obj.retryFailedIds.forEach(identifier);
    requireThat(new Set(obj.retryFailedIds).size === obj.retryFailedIds.length);
  }
  return obj as unknown as Continue;
}
function probability(value: unknown): number {
  requireThat(typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1);
  return value;
}
export function parseAnswers(value: unknown, questions: Record<string, Question>): Record<string, Answer> {
  try {
    const answers = exact(copyJson(value, BOUNDS.answerBytes), Object.keys(questions));
    for (const [id, q] of Object.entries(questions)) {
      const a = exact(answers[id], q.type === "choice" ? ["type", "choice", "probabilities", "confidence"] :
        q.type === "score" ? ["type", "score", "confidence"] : ["type", "probability"]);
      requireThat(a.type === q.type);
      if (q.type === "bool") probability(a.probability);
      else {
        probability(a.confidence);
        if (q.type === "score") requireThat(typeof a.score === "number" && Number.isFinite(a.score) && a.score >= 0 && a.score <= q.criteria.length - 1);
        else {
          requireThat(typeof a.choice === "string" && Object.hasOwn(q.criteria, a.choice));
          const probabilities = exact(a.probabilities, Object.keys(q.criteria));
          const sum = Object.values(probabilities).reduce<number>((total, p) => total + probability(p), 0);
          requireThat(Math.abs(sum - 1) <= 1e-6);
        }
      }
    }
    return answers as unknown as Record<string, Answer>;
  } catch { throw new ToolkitError("invalid_response"); }
}
