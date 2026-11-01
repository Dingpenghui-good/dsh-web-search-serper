/**
 * DSH Web Search Serper — Serper.dev 搜索提供方，挂载到 DSH 的 web 能力 seam（ctx.web）。
 *
 * 注册 `serper` 搜索提供方，并在注册后**自动把 seam 的 `searchProvider` 接管为
 * `serper`**——因此插件装好即生效，不需要任何 `cordis.patch.yml` 书写，也不需要
 * 重启（seam 每次 search 时解析选择）。部署方若用环境变量
 * `$DSH_WEB_SEARCH_PROVIDER` 显式指定了别的 provider，插件让位。
 *
 * API key 解析顺序（每次搜索时惰性解析，凭证库改动无需重启）：
 * 1. 插件 config 的 `apiKey` 字段（显式优先）；
 * 2. 宿主进程环境变量 `$SERPER_API_KEY`；
 * 3. 凭证库引用 `SERPER_API_KEY`（`$DSH_HOME/.credentials.yaml` refs，热解析）。
 *
 * @module dsh-web-search-serper
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// dsh-web 只在类型面被消费：provider 抛出的错误类在本包内定义（0.2.1 的
// WebError 是 `class WebError extends HarnessError {}` 的空壳），因此注册与
// 搜索路径都不需要 dsh-web 的运行时实例。
import type { WebSearchProvider } from '@deepseek-ai/dsh-web'
import { SerperSearchProvider, SERPER_DEFAULT_BASE_URL, SERPER_PROVIDER_ID } from './provider.ts'

/** 导出 Provider 标识 / 默认端点 */
export { SERPER_PROVIDER_ID } from './provider.ts'
export { SERPER_DEFAULT_BASE_URL } from './provider.ts'
/** 导出 Provider 类、错误类与映射函数 */
export { SerperSearchProvider, SerperWebError, mapSerperResult, mapSerperResponse } from './provider.ts'
/** 导出类型 */
export type { SerperSearchProviderOptions } from './provider.ts'
export type {
  SerperSearchRequest,
  SerperSearchResponse,
  SerperOrganicResult,
  SerperKnowledgeGraph,
  SerperRelatedQuestion,
  SerperError,
} from './types.ts'
import { SerperStatusTracker, type SerperKeySource, type SerperRuntimeStatus } from './status.ts'

export type { SerperRuntimeStatus, SerperLastSearch, SerperKeySource } from './status.ts'

/** Cordis 插件名（用于 loader 诊断） */
export const name = 'web-search-serper'

/** 注入的服务：web seam 是本插件唯一的硬依赖。 */
export const inject = ['web'] as const

/**
 * 插件配置接口。
 *
 * **只有 `apiKey`**：检索本身不需要任何调参。
 *
 * `baseURL` / `gl` / `cr` / `numResults` 曾在旧版作为可选设置暴露，但它们是纯粹的
 * 风险来源——`gl: cn` 会让英文技术查询返回中文站点、`numResults` 会覆盖宿主工具
 * 下发的条数，用户很难意识到「结果不对」正是这些开关造成的。现在：
 * 端点固定为 Serper 官方端点，结果条数由宿主 `tool-web` 的 `maxResults` 决定，
 * 区域跟随 Serper 默认。
 */
export interface Config {
  /** Serper API Key；缺省回退到 $SERPER_API_KEY，再到凭证库 SERPER_API_KEY 引用 */
  apiKey?: string
}

/**
 * 运行时 schema：Loader 据此解析行 config 并补默认值；secret 字段带 volatile
 * 标记——设置页可编辑，保存后经 volatile HMR 即时生效。
 * 导出名必须是 `Config`：宿主 settings 框架按此导出注册 configForms 命名空间。
 *
 * 已删除的旧字段（`baseURL` / `gl` / `cr` / `numResults`）在解析时被直接丢弃，
 * 因此老 profile 里残留的值既不报错，也不会再影响检索。
 */
export const Config = z.object({
  apiKey: z.string().role('secret').volatile(),
})

/** 旧导出名别名（兼容已引用 ConfigSchema 的代码）。 */
export const ConfigSchema = Config

/** 凭证库引用名（$DSH_HOME/.credentials.yaml refs 下） */
const SERPER_CREDENTIAL_REF = 'SERPER_API_KEY'

/** `ctx.settings` 的最小读取面：`describe()` 返回每个 plugin entry 的解析值。 */
interface SettingsReadFace {
  describe(): Array<{ ns: string; value?: unknown }>
}

/** `ctx.credentials` 的最小读取面。 */
interface CredentialsReadFace {
  resolve(ref: string): Promise<{ value?: string } | undefined>
}

/** web seam 上暴露的搜索注册表（provider 降级时读取）。 */
interface WebRegistryFace {
  searchProviders?: Map<string, WebSearchProvider>
}

/**
 * web seam 的搜索选择面（接管搜索用）。
 *
 * `config.searchProvider` 是 cosmokit 的 volatile 包装：`get()` 读当前值，
 * `set()` 写入即让后续每次 `search()` 走新 id（seam 在调用时解析，不缓存），
 * 因此接管**不必重启**。环境变量 `$DSH_WEB_SEARCH_PROVIDER` 与该字段同权，
 * 且在 seam 侧优先于 config，所以本插件在环境变量显式指向别的 provider 时
 * 让位——那是部署方的显式意志，插件不该覆盖。
 */
interface WebSelectionFace {
  config?: { searchProvider?: { get?(): string | undefined; set?(id: string): void } }
}

/** `ctx.logger` 的最小面向：宿主未提供时全部可选，缺失即不记录。 */
interface LoggerFace {
  debug?(message: string, ...args: unknown[]): void
  warn?(message: string, ...args: unknown[]): void
  error?(message: string, ...args: unknown[]): void
}

/**
 * 读一个 config 字段的普通值。
 *
 * `volatile()` 字段在 `ctx.settings` 的解析值里是 cosmokit 的 volatile 包装
 * （`{ get(): T }`，带 `Symbol(cosmokit.volatile.write)`），而不是裸值；宿主自己
 * 的展示层用 `isVolatile(value) ? value.get() : value` 解包（settings/schema.ts
 * 的 `plainConfig`）。这里做同一件事，并对裸值保持兼容。
 * @param value - 字段值，可能是 volatile 包装、普通值或 undefined。
 * @returns 普通值。
 */
function plain(value: unknown): unknown {
  if (value !== null && typeof value === 'object') {
    const get = Reflect.get(value, 'get')
    if (typeof get === 'function') {
      try {
        return get.call(value)
      } catch {
        return undefined
      }
    }
  }
  return value
}

/**
 * 注册 Serper 搜索提供方到 ctx.web。
 *
 * 0.1.7 的 settings 保存在 `ctx.settings.describe()` 中反映，且不会重激活本插件
 * fiber，因此 key / 端点等值全部惰性读取：每次搜索时对 ctx 做实时服务查找
 * （credentials 服务热解析）并重读当前 config 行，改动保存后对后续请求即时生效。
 */
export function apply(ctx: Context): void {
  /** 宿主 logger（可选）：用于留痕「是否真的生效」。 */
  const logger = (ctx as unknown as { logger?: LoggerFace }).logger

  /** 当前行 config：按 entry id 在 `ctx.settings.describe()` 中查找；
   *  未组合 settings 服务时 undefined，走纯环境变量回退。 */
  const readConfig = (): Record<string, unknown> | undefined => {
    const settings = ctx.get('settings') as SettingsReadFace | undefined
    if (settings === undefined) return undefined
    try {
      const row = settings.describe().find((r) => r.ns === name)
      const v = plain(row?.value)
      return (v !== null && typeof v === 'object') ? (v as Record<string, unknown>) : undefined
    } catch {
      return undefined
    }
  }

  const str = (v: unknown): string | undefined => {
    const value = plain(v)
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }

  /** 惰性解析 API key：config.apiKey → 环境变量 → 凭证库（热）。 */
  const resolveKey = async (): Promise<string | undefined> => {
    const explicit = str(readConfig()?.apiKey)
    if (explicit !== undefined) return explicit
    const fromEnv = process.env.SERPER_API_KEY
    if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv
    const credentials = ctx.get('credentials') as CredentialsReadFace | undefined
    if (credentials === undefined) return undefined
    try {
      const resolved = await credentials.resolve(SERPER_CREDENTIAL_REF)
      return resolved === undefined ? undefined : str(resolved.value)
    } catch {
      // 凭证库不可用时降级：让 provider 以"无 key"判不可用，而不是抛错
      return undefined
    }
  }

  /** 仅用于诊断：报告 key 的实际来源，不返回值本身。 */
  const resolveKeySource = (): SerperKeySource => {
    if (str(readConfig()?.apiKey) !== undefined) return 'config'
    const fromEnv = process.env.SERPER_API_KEY
    if (typeof fromEnv === 'string' && fromEnv.length > 0) return 'env'
    return ctx.get('credentials') === undefined ? 'missing' : 'credential'
  }

  /** 插件运行状态：设置页据此判断「是否真的在生效」。 */
  const status = runtimeStatus
  // 降级 / 失败写日志：这是用户唯一能看出「Serper 没在工作」的途径。
  status.setHooks(
    (servedBy, reason) => {
      logger?.warn?.(
        `web-search-serper: fell back to "${servedBy}" — serper failed: ${reason}`,
      )
    },
    (reason) => {
      logger?.error?.(`web-search-serper: search failed and no usable fallback — ${reason}`)
    },
  )

  /** 降级目标：seam 注册表里除本插件外、第一个可用的搜索 provider
   *  （通常是 dsh-base 自带的 `deepseek-official`）。web seam 自身不做回退，
   *  因此这里直接读 seam 的注册表，在插件内完成降级。
   *  不硬编码 id：部署方换用其它搜索后端时同样能兜底。 */
  const resolveFallback = (): WebSearchProvider | undefined => {
    const registry = (ctx.get('web') as WebRegistryFace | undefined)?.searchProviders
    if (registry === undefined) return undefined
    for (const [id, candidate] of registry) {
      if (id === SERPER_PROVIDER_ID) continue
      try {
        if (candidate.available()) return candidate
      } catch {
        // 单个 provider 的可用性探针抛错不应阻断降级链
      }
    }
    return undefined
  }

  const provider = new SerperSearchProvider({
    // key 惰性解析（每次搜索时读取）：保存新 key 后对后续请求即时生效
    resolveKey,
    resolveKeySource,
    resolveFallback,
    status,
    // 端点固定为 Serper 官方端点；不再暴露 baseURL / gl / cr / numResults
    // 那几个会悄悄改变检索语义的开关。
    baseURLOptions: () => ({ baseURL: SERPER_DEFAULT_BASE_URL }),
  })

  ctx.web.registerSearchProvider(provider)
  status.markRegistered()

  // 注册成功即留痕：这是「插件是否真的在本进程生效」的唯一证据。
  // 未重启而改了 cordis.patch.yml 时，这里不会出现在日志里——正是排障入口。
  logger?.debug?.(
    `web-search-serper: registered search provider "serper" (key source: ${resolveKeySource()})`,
  )

  // 装好即生效：把 seam 的选择指到本 provider。这一步之前由 bundle patch 里
  // 的 `- id: web` 整行替换承担，但 patch 层会被 profile 自己的 `- id: web`
  // 覆盖、也会漏过配置在进程启动后才写入的情形，导致「装了却没被调用、且不
  // 报错」。改为运行时接管后，插件自己保证被寻址，不再依赖任何配置书写。
  const taken = takeOverSearch()

  const declared = declaredSearchProvider()
  if (taken === 'already') {
    logger?.debug?.(`web-search-serper: web.searchProvider already selects "${SERPER_PROVIDER_ID}"`)
  } else if (taken === 'declined') {
    // 部署方用环境变量显式指定了别的 provider：让位，但把话说清楚。
    logger?.warn?.(
      `web-search-serper: $DSH_WEB_SEARCH_PROVIDER is "${declared}", not "${SERPER_PROVIDER_ID}" — `
      + 'respecting it; this plugin is registered but will not be used',
    )
  } else if (taken === 'failed') {
    // 接管面不可写（旧宿主 / seam 形态不同）：退回「检查配置」的旧路径。
    if (declared !== undefined && declared !== SERPER_PROVIDER_ID) {
      logger?.warn?.(
        `web-search-serper: web.searchProvider is "${declared}", not "${SERPER_PROVIDER_ID}" — `
        + 'this plugin is loaded but will not be used until the web row selects it',
      )
    } else if (declared === undefined) {
      logger?.warn?.(
        'web-search-serper: the web row does not declare searchProvider — '
        + 'this plugin is registered but the seam will not route searches to it',
      )
    }
  } else {
    logger?.debug?.(`web-search-serper: took over web.searchProvider (was "${declared ?? 'unset'}")`)
  }

  /**
   * 把 web seam 的 `searchProvider` 指向本 provider，使插件「装好即生效」。
   *
   * 只在两种情况让位：环境变量 `$DSH_WEB_SEARCH_PROVIDER` 非空（部署方的显式
   * 选择，且 seam 侧优先于 config），或 seam 已指向 serper（无需改动）。
   *
   * 接管是 `set()` 一次即可：seam 在每次 search 时解析选择，不缓存结果，
   * 因此不必重启宿主，也不会在 profile 热重载后失效。
   * @returns 接管结果，供日志区分「本来就对」「让位」「失败」「刚改好」。
   */
  function takeOverSearch(): 'already' | 'declined' | 'failed' | 'adopted' {
    const fromEnv = process.env.DSH_WEB_SEARCH_PROVIDER
    if (typeof fromEnv === 'string' && fromEnv.length > 0 && fromEnv !== SERPER_PROVIDER_ID) {
      return 'declined'
    }
    const selection = (ctx.get('web') as WebSelectionFace | undefined)?.config?.searchProvider
    if (selection === undefined || typeof selection.set !== 'function') return 'failed'
    try {
      if (selection.get?.() === SERPER_PROVIDER_ID) return 'already'
      selection.set(SERPER_PROVIDER_ID)
      return selection.get?.() === SERPER_PROVIDER_ID ? 'adopted' : 'failed'
    } catch {
      // 旧宿主或只读 config：不让接管失败拖垮插件注册本身。
      return 'failed'
    }
  }

  /** 读取 dsh-base 的 web 行声明的 searchProvider（用于判断是否真的被选中）。
   *  环境变量 `$DSH_WEB_SEARCH_PROVIDER` 与 config 同权且 seam 侧优先，因此
   *  非空时视为「部署方显式声明」，返回它而不是 config 值。 */
  function declaredSearchProvider(): string | undefined {
    const fromEnv = process.env.DSH_WEB_SEARCH_PROVIDER
    if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv
    const settings = ctx.get('settings') as SettingsReadFace | undefined
    if (settings === undefined) return undefined
    try {
      const row = settings.describe().find((r) => r.ns === 'web')
      const value = plain(row?.value)
      if (value === null || typeof value !== 'object') return undefined
      return str((value as Record<string, unknown>).searchProvider)
    } catch {
      return undefined
    }
  }
}

/**
 * 模块级状态追踪器：跨插件重载保留，且可在不持有 ctx 的情况下读取，
 * 便于诊断工具直接取用。降级 / 失败同时写入宿主日志（见 apply）。
 */
const runtimeStatus = new SerperStatusTracker()

/**
 * 读取本插件在当前进程内的运行状态。
 *
 * 供排障使用：若 `registered` 为 false，说明插件层根本没有被加载
 * （最常见原因是改了 profile 的 `cordis.patch.yml` 后没有重启 DSH——
 * 该文件只在进程启动时读取一次）；若 `calls` 为 0，说明插件虽已加载但
 * 尚未被寻址（`web.searchProvider` 未指向 `serper`，或从未发起搜索）。
 * @returns 状态快照（只读，不含 key 值）。
 */
export function readRuntimeStatus(): SerperRuntimeStatus {
  return runtimeStatus.snapshot()
}
