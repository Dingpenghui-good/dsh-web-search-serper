/**
 * The runtime contract this plugin compiles against.
 *
 * `0.2.0-rc.2` ships the platform packages this plugin talks to as JavaScript
 * WITHOUT `.d.ts` in the installed runtime, and the type-declaring copies are
 * not published for that line. Rather than reach across a missing boundary,
 * this file restates — and only restates — the surface the plugin consumes.
 *
 * Each declaration below was checked against the shipped `lib/*.js` of the
 * target runtime (0.2.0-rc.2); nothing beyond that surface is declared, and
 * the eslint-style rule for this file is: it may shrink, never grow beyond
 * evidence.
 *
 * No top-level import/export appears in this file on purpose: that is what
 * keeps each `declare module` below an AMBIENT module declaration (a script
 * file merges them as such), which is how a module without its own `.d.ts` gets
 * a typed surface.
 */

declare module '@deepseek-ai/dsh-llm' {
  /** Base class of every harness error: `message` + machine-routable `code` + `cause`. */
  export class HarnessError extends Error {
    /** Stable machine-routable failure class; route on this, never parse `message`. */
    readonly code: string
    /** Error name; subclasses default it to their constructor name. */
    name: string
    constructor(message: string, code: string, options?: ErrorOptions)
  }
}

declare module '@deepseek-ai/dsh-web' {
  /** Normalized search request (one query, optional result bound). */
  export interface WebSearchRequest {
    readonly query: string
    readonly maxResults?: number
  }

  /** One citeable source. */
  export interface WebSearchSource {
    readonly url: string
    readonly title?: string
    readonly snippet?: string
    readonly publishedAt?: string
  }

  /** Normalized search outcome (`truncated` is set by the seam). */
  export interface WebSearchResult {
    readonly content?: string
    readonly sources: readonly WebSearchSource[]
    readonly truncated: boolean
  }

  /** A search-capable backend registered with `ctx.web.registerSearchProvider`. */
  export interface WebSearchProvider {
    readonly id: string
    /** Cheap local usability check; never a network call. */
    available(): boolean
    /** Run one search; honor `signal` for cancellation. */
    search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>
  }

  /** Typed web error: `class WebError extends HarnessError {}` (open-string `code`). */
  export class WebError extends import('@deepseek-ai/dsh-llm').HarnessError {
    constructor(message: string, code: string, options?: ErrorOptions)
    /** Error name; the runtime's base class stamps the constructor name. */
    name: string
  }
  /** Search/fetch registries and provider selection. */
  export class WebRuntime {
    readonly searchProviders: Map<string, WebSearchProvider>
    registerSearchProvider(provider: WebSearchProvider): () => void
    search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>
  }
}

declare module '@deepseek-ai/cordis' {
  /**
   * cordis mixes the core service methods onto `ctx` at runtime
   * (`ReflectService`'s constructor calls `mixin('reflect', ['get', …])` and
   * `mixin('fiber', ['effect'])`), but declares those additions by the RELATIVE
   * module id `./context.ts`. A package consumer therefore sees `ctx.get` /
   * `ctx.effect` as absent; restating the two members this plugin calls keeps
   * the contract honest without pretending the runtime differs.
   */
  interface Context {
    /** Read a service from the store without the inject requirement. */
    get<K extends string & keyof this>(name: K, strict?: boolean): this[K] | undefined
    /** Same as above for service names outside the typed `Context` surface. */
    get(name: string, strict?: boolean): unknown
    /**
     * Register one disposable with the calling fiber.
     * @param effect - the disposer (or an iterable / promise of them).
     * @param label - human-readable label for diagnostics.
     * @returns the fiber's effect disposer.
     */
    effect(effect: unknown, label?: string): () => void
    /** The web capability seam (`ctx.web`, provided by `@deepseek-ai/dsh-web`). */
    web: import('@deepseek-ai/dsh-web').WebRuntime
    /** Browser-only merges: present only in the client composition. */
    slots: import('./contract.ts').SlotRegistryFace
    locale: import('./contract.ts').LocaleRuntimeFace
  }
}
