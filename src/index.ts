/**
 * DSH Web Search Serper — Serper.dev 搜索提供方，挂载到 DSH 的 web 能力 seam（ctx.web）。
 *
 * 注册 `serper` 搜索提供方，`web` 服务的 `searchProvider` 设为 `serper`（或
 * 它是唯一可用的搜索后端）时，`ctx.web.search()` 自动解析到它。
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
// 宿主 Service 由运行时组合；插件包声明为普通依赖会与宿主版本产生 peer 漂移，
// 导致启动时整组插件卡在"等待服务"。dsh-web 仅在类型面被消费（WebError 通过
// 运行时 import 注入，见 provider.ts），此处不产生额外运行时依赖。
import type { WebSearchProvider } from '@deepseek-ai/dsh-web'
import { SerperSearchProvider, SERPER_DEFAULT_BASE_URL, SERPER_PROVIDER_ID } from './provider.ts'

/** 导出 Provider 标识 / 默认端点 */
export { SERPER_PROVIDER_ID } from './provider.ts'
export { SERPER_DEFAULT_BASE_URL } from './provider.ts'
/** 导出 Provider 类和映射函数 */
export { SerperSearchProvider, mapSerperResult, mapSerperResponse } from './provider.ts'
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

/** 运行时 schema：Loader 据此解析行 config 并补默认值；secret 字段带 volatile
 *  标记——设置页可编辑，保存后经 profile patch + volatile HMR 即时生效。
 *  导出名必须是 `Config`：宿主 settings 框架按此导出注册 configForms 命名空间
 *  （与 dsh-obsidian-sync 的约定一致）。 */
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

/**
 * 注册 Serper 搜索提供方到 ctx.web。
 *
 * 0.2.0-rc.2 的 settings 保存不会重激活本插件 fiber，因此 key / 端点等值全部
 * 惰性读取：每次搜索时对 ctx 做实时注册表查找（credentials 服务热解析）并
 * 重读当前 config 行，改动保存后对后续请求即时生效，无需重启。
 */
export function apply(ctx: Context): void {
  /** 当前行 config（settings describe 按 entry id 排序；本插件 entry id 是
   *  web-search-serper；未组合 settings 时 undefined，走纯环境变量回退）。 */
  const readConfig = (): Record<string, unknown> | undefined => {
    const settings = ctx.get('settings') as
      | { describe(): Array<{ ns: string; value?: unknown }> }
      | undefined
    if (settings === undefined) return undefined
    try {
      const row = settings.describe().find((r) => r.ns === 'web-search-serper')
      const v = row?.value
      return (v !== null && typeof v === 'object') ? (v as Record<string, unknown>) : undefined
    } catch {
      return undefined
    }
  }

  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined

  /** 惰性解析 API key：config.apiKey → 环境变量 → 凭证库（热）。 */
  const resolveKey = async (): Promise<string | undefined> => {
    const explicit = str(readConfig()?.apiKey)
    if (explicit !== undefined) return explicit
    const fromEnv = process.env.SERPER_API_KEY
    if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv
    const credentials = ctx.get('credentials')
    if (credentials === undefined) return undefined
    try {
      const resolved = await credentials.resolve(SERPER_CREDENTIAL_REF)
      return resolved === undefined ? undefined : resolved.value
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
    const registry = (ctx.get('web') as
      | { searchProviders?: Map<string, WebSearchProvider> }
      | undefined)?.searchProviders
    if (registry === undefined) return undefined
    for (const [id, candidate] of registry) {
      if (id === SERPER_PROVIDER_ID) continue
      if (candidate.available()) return candidate
    }
    return undefined
  }

  const provider = new SerperSearchProvider({
    // key / 端点全部惰性（每次搜索时读取）：保存新 config 后对后续请求生效
    resolveKey,
    resolveFallback,
    baseURLOptions: () => {
      const cfg = readConfig()
      return {
        baseURL: str(cfg?.baseURL) ?? SERPER_DEFAULT_BASE_URL,
        ...(str(cfg?.gl) !== undefined ? { gl: str(cfg?.gl) } : {}),
        ...(str(cfg?.cr) !== undefined ? { cr: str(cfg?.cr) } : {}),
        ...(num(cfg?.numResults) !== undefined ? { numResults: num(cfg?.numResults) } : {}),
      }
    },
  })

  ctx.web.registerSearchProvider(provider)
}
