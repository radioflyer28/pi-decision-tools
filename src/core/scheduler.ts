import { ToolkitError, requireThat } from "./errors.js";

type Job = { run: () => Promise<unknown>; resolve: (value: unknown) => void; reject: (error: unknown) => void;
  signal?: AbortSignal; onAbort?: () => void };
/** One queue per batch, visited round-robin. Slots belong to underlying promises. */
export class FairScheduler {
  #queues = new Map<string, Job[]>();
  #order: string[] = [];
  #active = 0;
  #scheduled = false;
  constructor(private readonly capacity: () => number) {}
  get active(): number { return this.#active; }
  get queued(): number { return [...this.#queues.values()].reduce((sum, jobs) => sum + jobs.length, 0); }
  enqueue<T>(batchId: string, run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(new ToolkitError("cancelled"));
    return new Promise<T>((resolve, reject) => {
      const job: Job = { run, resolve: value => resolve(value as T), reject };
      if (signal) {
        job.signal = signal;
        job.onAbort = () => {
          const queue = this.#queues.get(batchId), index = queue?.indexOf(job) ?? -1;
          if (index < 0) return;
          queue!.splice(index, 1); this.#removeEmpty(batchId);
          signal.removeEventListener("abort", job.onAbort!);
          reject(new ToolkitError("cancelled")); this.#kick();
        };
        signal.addEventListener("abort", job.onAbort, { once: true });
      }
      let queue = this.#queues.get(batchId);
      if (!queue) { queue = []; this.#queues.set(batchId, queue); this.#order.push(batchId); }
      queue.push(job); this.#kick();
    });
  }
  #removeEmpty(key: string): void {
    if (this.#queues.get(key)?.length) return;
    this.#queues.delete(key); this.#order = this.#order.filter(k => k !== key);
  }
  #kick(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => { this.#scheduled = false; this.#drain(); });
  }
  #drain(): void {
    const capacity = this.capacity();
    requireThat(Number.isInteger(capacity) && capacity >= 1 && capacity <= 8, "invalid_scheduler_capacity");
    while (this.#active < capacity && this.#order.length) {
      const key = this.#order.shift()!, queue = this.#queues.get(key)!, job = queue.shift()!;
      if (queue.length) this.#order.push(key); else this.#queues.delete(key);
      if (job.signal && job.onAbort) job.signal.removeEventListener("abort", job.onAbort);
      if (job.signal?.aborted) { job.reject(new ToolkitError("cancelled")); continue; }
      this.#active++;
      // Run in a promise boundary so synchronous provider failures release the slot too.
      Promise.resolve().then(job.run).then(job.resolve, job.reject).finally(() => {
        this.#active--; this.#kick();
      });
    }
  }
}

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(timer: unknown): void;
}
export const monotonicClock: Clock = {
  now: () => performance.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: timer => clearTimeout(timer as ReturnType<typeof setTimeout>),
};
export class InvocationScope {
  readonly controller = new AbortController();
  readonly started: number;
  #timer: unknown;
  #reason: "cancelled" | "deadline" | "disabled" | undefined;
  #onAbort: (() => void) | undefined;
  constructor(maxWorkMs: number, private readonly caller?: AbortSignal, readonly clock: Clock = monotonicClock) {
    this.started = clock.now();
    this.#timer = clock.setTimeout(() => this.abort("deadline"), maxWorkMs);
    if (caller) {
      this.#onAbort = () => this.abort("cancelled");
      caller.addEventListener("abort", this.#onAbort, { once: true });
      if (caller.aborted) this.abort("cancelled");
    }
  }
  get signal(): AbortSignal { return this.controller.signal; }
  get reason(): "cancelled" | "deadline" | "disabled" | undefined { return this.#reason; }
  get elapsedMs(): number { return Math.max(0, this.clock.now() - this.started); }
  abort(reason: "cancelled" | "deadline" | "disabled"): void {
    if (this.signal.aborted) return;
    this.#reason = reason; this.controller.abort(reason);
  }
  attempt(maxAttemptMs: number): { signal: AbortSignal; dispose(): void } {
    const controller = new AbortController();
    const propagate = () => controller.abort(this.signal.reason);
    this.signal.addEventListener("abort", propagate, { once: true });
    if (this.signal.aborted) propagate();
    const timer = this.clock.setTimeout(() => controller.abort("deadline"), maxAttemptMs);
    return { signal: controller.signal, dispose: () => {
      this.clock.clearTimeout(timer); this.signal.removeEventListener("abort", propagate);
    } };
  }
  dispose(): void {
    this.clock.clearTimeout(this.#timer);
    if (this.caller && this.#onAbort) this.caller.removeEventListener("abort", this.#onAbort);
  }
}
