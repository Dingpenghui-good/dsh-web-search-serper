/**
 * The slot / locale contract this plugin compiles against, declared as an
 * ambient module.
 *
 * `0.2.0-rc.2` ships `@deepseek-ai/dsh-client-ui-slots` and its `…/client`
 * contract entries as JavaScript only in the installed runtime, so TypeScript
 * would treat every import as `any`. Declaring the module here restores the
 * typed surface the plugin actually consumes — checked against the shipped
 * `lib/index.js` of `dsh-client-ui-slots` / `dsh-client-ui-renderer` — and makes
 * the plugin's own `LocaleNamespaceMap` / `SlotMap` merges meaningful.
 *
 * Anything not declared here is deliberately not part of the contract.
 */

declare module '@deepseek-ai/dsh-client-ui-slots' {
  /** Translate a dictionary key with optional `{name}` template params. */
  export type Translate<K extends string = string> = (key: K, params?: Record<string, unknown>) => string

  /** Namespace-addressed translate: the framework-injected `t` seat. */
  export type TranslateNS<N extends keyof LocaleNamespaceMap & string> =
    Translate<LocaleNamespaceMap[N] & string>

  /** The locale `t` seat for entries whose registration declares `locale:`. */
  export type PropsLocale<N> = N extends keyof LocaleNamespaceMap & string
    ? { readonly t: TranslateNS<N> }
    : object

  /** Slot contract table; owners extend it via declaration merging. */
  export interface SlotMap {}

  /** Locale namespace table: key → the union of its dictionary keys. */
  export interface LocaleNamespaceMap {}

  /** Owner props of one keyed slot key (`object` when the entry declares none). */
  export type OwnerOf<K extends string> = K extends keyof SlotMap
    ? SlotMap[K] extends { owner: infer O extends object } ? O : object
    : object

  /** The runtime props a keyed slot passes to its entries. */
  export type PropsRuntime<K extends string> = OwnerOf<K>

  /** Bind a namespace's translate function (the registry's typed `bind`). */
  export type BindLocale = <N extends keyof LocaleNamespaceMap & string>(ns: N) => TranslateNS<N>
}

declare module '@deepseek-ai/dsh-client-ui-renderer/client' {}
declare module '@deepseek-ai/dsh-client-locale/client' {}
