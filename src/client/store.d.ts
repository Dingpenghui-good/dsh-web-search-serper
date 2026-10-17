/**
 * The `@deepseek-ai/dsh-client-store` surface this plugin uses, declared
 * locally because `0.2.0-rc.2` ships the package as JavaScript only.
 */

declare module '@deepseek-ai/dsh-client-store' {
  /**
   * A publish/subscribe value store. Slot components read it through a bound
   * selector hook (`props.useX(selector)`), which the renderer synthesizes from
   * an inject face's `hooks` compartment.
   */
  export interface SnapshotStore<T> {
    /** Current value (stable reference until the next change). */
    getSnapshot(): T
    /** Replace the value and notify subscribers. */
    set(next: T): void
    /** Observe replacements. */
    subscribe(listener: () => void): () => void
  }

  /**
   * Create a snapshot store seeded with `initial`.
   * @param initial - the first published value.
   * @returns the store.
   */
  export function createSnapshotStore<T>(initial: T): SnapshotStore<T>
}
