import { BOUNDS } from "./validation.js";
import { requireThat } from "./errors.js";

declare const tokenBrand: unique symbol;
export type MemoryToken = { readonly [tokenBrand]: true };
interface Allocation { retained: number; reserved: number }
/** One serialized-data ceiling, not a JS heap estimate. Tokens belong to exactly one pool. */
export class RetainedMemory {
  #allocations = new WeakMap<MemoryToken, Allocation>();
  #retained = 0;
  #reserved = 0;
  get retainedBytes(): number { return this.#retained; }
  get reservedBytes(): number { return this.#reserved; }
  get availableBytes(): number { return BOUNDS.workspaceBytes - this.#retained - this.#reserved; }
  #bytes(value: number): void { requireThat(Number.isSafeInteger(value) && value >= 0, "invalid_memory_allocation"); }
  #get(token: MemoryToken): Allocation {
    const value = this.#allocations.get(token); requireThat(value, "invalid_memory_allocation"); return value;
  }
  allocate(retained = 0, reserved = 0): MemoryToken {
    this.#bytes(retained); this.#bytes(reserved);
    requireThat(retained <= this.availableBytes && reserved <= this.availableBytes - retained, "workspace_full");
    const token = Object.freeze({}) as MemoryToken;
    this.#allocations.set(token, { retained, reserved }); this.#retained += retained; this.#reserved += reserved;
    return token;
  }
  resize(token: MemoryToken, retained: number, reserved: number): void {
    const current = this.#get(token); this.#bytes(retained); this.#bytes(reserved);
    const available = this.availableBytes + current.retained + current.reserved;
    requireThat(retained <= available && reserved <= available - retained, "workspace_full");
    this.#retained += retained - current.retained; this.#reserved += reserved - current.reserved;
    current.retained = retained; current.reserved = reserved;
  }
  /** Atomically consume a dedicated growth reservation into an existing owner's retained data. */
  commitGrowth(source: MemoryToken, destination: MemoryToken, bytes: number): void {
    const growth = this.#get(source), owner = this.#get(destination); this.#bytes(bytes);
    requireThat(source !== destination && growth.retained === 0 && bytes <= growth.reserved, "invalid_memory_allocation");
    this.#reserved -= growth.reserved; this.#retained += bytes; owner.retained += bytes;
    this.#allocations.delete(source);
  }
  release(token: MemoryToken): void {
    const current = this.#allocations.get(token);
    if (!current) return; // Idempotent cleanup never refunds another pool or a consumed token.
    this.#retained -= current.retained; this.#reserved -= current.reserved; this.#allocations.delete(token);
  }
}
