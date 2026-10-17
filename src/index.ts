/**
 * DSH Web Search Serper — Serper.dev 搜索提供方，挂载到 DSH 的 web 能力 seam（ctx.web）。
 *
 * 注册 `serper` 搜索提供方；当 `web` 服务的 `searchProvider` 设为 `serper` 时，
 * `ctx.web.search()` 自动解析到它。
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

/** Cordis 插件名（用于 loader 诊断） */
export const name = 'web-search-serper'

/** 注入的服务：web seam 是本插件唯一的硬依赖。 */
export const inject = ['web'] as const

/** 插件配置接口（全部可选；缺省时走环境变量 → 凭证库回退链）。 */
export interface Config {
  /** Serper API Key；缺省回退到 $SERPER_API_KEY，再到凭证库 SERPER_API_KEY 引用 */
  apiKey?: string
  /** 端点基址，默认 https://google.serper.dev（/search 自动追加） */
  baseURL?: string
  /** 默认国家代码，如 'us', 'cn', 'jp' */
  gl?: string
  /** 默认地区代码，如 'us'（作为 cr 参数发送） */
  cr?: string
  /** 默认结果数量（请求未携带 maxResults 时）；省略则不发送 num */
  numResults?: number
}

/**
 * 运行时 schema：Loader 据此解析行 config 并补默认值；secret 字段带 volatile
 * 标记——设置页可编辑，保存后经 volatile HMR 即时生效。
 * 导出名必须是 `Config`：宿主 settings 框架按此导出注册 configForms 命名空间。
 */
export const Config = z.object({
  apiKey: z.string().role('secret').volatile(),
  baseURL: z.string().volatile(),
  gl: z.string().volatile(),
  cr: z.string().volatile(),
  numResults: z.number().step(1).min(1).max(100).volatile(),
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
  const num = (v: unknown): number | undefined => {
    const value = plain(v)
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
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
    // key / 端点全部惰性（每次搜索时读取）：保存新 config 后对后续请求生效
    resolveKey,
    resolveFallback,
    baseURLOptions: () => {
      const cfg = readConfig()
      const baseURL = str(cfg?.baseURL)
      const gl = str(cfg?.gl)
      const cr = str(cfg?.cr)
      const numResults = num(cfg?.numResults)
      return {
        baseURL: baseURL ?? SERPER_DEFAULT_BASE_URL,
        ...(gl !== undefined ? { gl } : {}),
        ...(cr !== undefined ? { cr } : {}),
        ...(numResults !== undefined ? { numResults } : {}),
      }
    },
  })

  ctx.web.registerSearchProvider(provider)
}
