/**
 * Client-half runtime faces consumed by this plugin.
 *
 * Declared as its own module (not a `declare module` augmentation) because
 * `src/contracts.d.ts` references these names for the `ctx.slots` /
 * `ctx.locale` merges; consumers only `import type` them.
 */

/** The slot-registry face this plugin calls (`@deepseek-ai/dsh-client-ui-renderer` provides it). */
export interface SlotRegistryFace {
  /**
   * Install the callback for each declaration lifetime of a slot: it runs once
   * the slot is declared and is disposed when the declaration collapses.
   * @param key - declared slot key.
   * @param callback - creates the contribution; returns its disposer.
   * @returns idempotent disposer for the wait and the active effect.
   */
  inject(key: string, callback: () => () => void): () => void
  /**
   * Contribute a component to a declared slot.
   * @param options - registration options (`name`, keyed `key`, `locale`, …).
   * @param component - the slot component.
   * @returns disposer removing the contribution.
   */
  register(options: Record<string, unknown>, component: unknown): () => void
}

/** The locale-runtime face this plugin calls (`@deepseek-ai/dsh-client-locale` provides it). */
export interface LocaleRuntimeFace {
  /**
   * Register a namespace's dictionaries, all locales in one call.
   * @param ns - namespace; duplicate (ns, locale) throws.
   * @param dicts - dictionaries keyed by locale id.
   * @returns disposer removing every locale registered by this call.
   */
  register(ns: string, dicts: Record<string, Record<string, string>>): () => void
}
