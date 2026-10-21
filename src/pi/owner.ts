import { randomUUID } from "node:crypto";
import type { Client, Consumer, ExecutionResult, Limits, ModelKey } from "../core/contracts.js";
import type { Coordinator } from "../core/coordinator.js";
import { CONFLICT, DISCOVER, discover, type DiscoveryHost, type OwnerReply } from "../core/discovery.js";
import { errorCode, requireThat } from "../core/errors.js";

export interface OwnerHost extends DiscoveryHost {
  events: DiscoveryHost["events"] & { on(channel: string, handler: (data: unknown) => void): () => void };
}
import { SemanticExecution } from "../semantic/execution.js";
import { SemanticResults } from "../semantic/results.js";

interface SemanticService { execution: SemanticExecution; results: SemanticResults }
interface SearchFiles { root: string; fileExclusions?: readonly string[] }
interface Runtime { coordinator: Coordinator; sessionId: string; semantic: SemanticService; quiescing: number; files: SearchFiles | undefined }
function semanticService(core: Coordinator, files?: SearchFiles): SemanticService {
  const execution = new SemanticExecution(core, undefined, files);
  return { execution, results: new SemanticResults(execution.parents) };
}
export class SessionOwner {
  readonly ownerId = randomUUID();
  #runtime: Runtime | undefined;
  #conflict = false;
  #retiring: Promise<void> | undefined;
  #disposed = false;
  #off: (() => void)[] = [];
  constructor(host: OwnerHost) {
    const reply: OwnerReply = { protocol: 1, ownerId: this.ownerId, getClient: id => this.client(id, "library") };
    this.#off.push(host.events.on(DISCOVER, data => {
      if (typeof data === "object" && data !== null && "reply" in data && typeof data.reply === "function") data.reply(reply);
    }));
    this.#off.push(host.events.on(CONFLICT, () => {
      this.#conflict = true;
      this.#runtime?.semantic.execution.pause();
      this.#runtime?.coordinator.disable();
    }));
  }
  get coordinator(): Coordinator | undefined { return this.#runtime?.coordinator; }
  current(sessionId: string): Coordinator {
    this.#check(); const runtime = this.#runtime;
    requireThat(runtime, "coordinator_unavailable");
    requireThat(runtime.sessionId === sessionId, "runtime_expired");
    return runtime.coordinator;
  }
  #check(runtime?: Runtime): void {
    requireThat(!this.#conflict, "coordinator_conflict");
    requireThat(!this.#disposed, "runtime_expired");
    if (runtime) requireThat(runtime === this.#runtime, "runtime_expired");
  }
  attach(coordinator: Coordinator, files?: SearchFiles): void {
    this.#check(); requireThat(!this.#runtime && !this.#retiring, "runtime_busy");
    const context = files ? { root: files.root, fileExclusions: [...(files.fileExclusions ?? [])] } : undefined;
    this.#runtime = { coordinator, sessionId: coordinator.controls.ledger.sessionId, semantic: semanticService(coordinator, context), quiescing: 0, files: context };
  }
  client(sessionId: string, consumer: Consumer): Client {
    this.#check(); const runtime = this.#runtime;
    requireThat(runtime, "coordinator_unavailable");
    requireThat(runtime.sessionId === sessionId, "runtime_expired");
    const failure = (error: unknown): ExecutionResult => {
      const code = errorCode(error, "model_unavailable");
      return { data: { ok: false, error: { code, message: code } } };
    };
    const preflight = async () => {
      this.#check(runtime); runtime.coordinator.controls.authorize(consumer);
      await runtime.coordinator.classifier.refresh();
      this.#check(runtime);
    };
    return {
      protocol: 1,
      submit: async (input, options) => {
        try { await preflight(); return await runtime.coordinator.submit(input, consumer, options); }
        catch (error) { return failure(error); }
      },
      continue: async (input, options) => {
        try { await preflight(); return await runtime.coordinator.continue(input, consumer, options); }
        catch (error) { return failure(error); }
      },
      results: input => {
        try { this.#check(runtime); return runtime.coordinator.results(input); }
        catch (error) { return failure(error); }
      },
    };
  }
  semantic(sessionId: string): SemanticService {
    this.current(sessionId); return this.#runtime!.semantic;
  }
  release(sessionId: string, handle: string): void {
    const core = this.current(sessionId);
    if (handle.startsWith("sem-")) this.#runtime!.semantic.execution.parents.release(handle);
    else core.release(handle);
  }
  enable(sessionId: string, model?: ModelKey, limits?: Limits): void {
    const core = this.current(sessionId), runtime = this.#runtime!;
    requireThat(runtime.quiescing === 0, "runtime_busy");
    core.controls.enable(model, limits); runtime.semantic.execution.open();
  }
  async pause(): Promise<void> {
    const runtime = this.#runtime;
    if (!runtime) { await this.#retiring; return; }
    runtime.quiescing++;
    runtime.semantic.execution.pause(); runtime.coordinator.disable();
    try { await Promise.all([runtime.semantic.execution.drain(), runtime.coordinator.drain()]); }
    finally { runtime.quiescing--; }
  }
  async navigate(): Promise<void> {
    const runtime = this.#runtime;
    if (!runtime) { await this.#retiring; return; }
    runtime.quiescing++;
    // Invalidate the captured semantic generation before any awaited settlement.
    runtime.coordinator.disable();
    try {
      await runtime.semantic.execution.expire();
      await runtime.coordinator.drain();
      if (runtime !== this.#runtime) return;
      runtime.coordinator.clear();
      runtime.semantic = semanticService(runtime.coordinator, runtime.files);
      runtime.semantic.execution.pause();
    } finally { runtime.quiescing--; }
  }
  async retire(): Promise<void> {
    if (this.#retiring) { await this.#retiring; return; }
    const runtime = this.#runtime; this.#runtime = undefined;
    if (!runtime) return;
    runtime.semantic.execution.pause(); runtime.coordinator.disable();
    const retiring = (async () => {
      // Child releases need a live core; expire it only after parent cleanup.
      try { await runtime.semantic.execution.expire(); }
      finally { await runtime.coordinator.expire(); }
    })();
    this.#retiring = retiring;
    try { await retiring; } finally { this.#retiring = undefined; }
  }
  async dispose(): Promise<void> {
    this.#disposed = true;
    for (const off of this.#off.splice(0)) off();
    await this.retire();
  }
}
/** Synchronous discovery/install is the factory's registration linearization point. */
export function installOwner(host: OwnerHost): SessionOwner | undefined {
  if (discover(host)) return undefined;
  return new SessionOwner(host);
}
