/**
 * Serper.dev 搜索提供方插件，集成到 DeepSeek Harness 的 web 能力 seam。
 *
 * 注册为 `serper` 搜索提供方，当它是唯一可用的搜索后端时，
 * `ctx.web.search()` 会自动解析到它——也可以用 `searchProvider: serper` 固定。
 *
 * API key 解析顺序（apply 时取前两层，search 时按需取第三层）：
 * 1. 插件 config 的 `apiKey` 字段（显式优先）；
 * 2. 宿主进程环境变量 `$SERPER_API_KEY`；
 * 3. 凭证库引用 `SERPER_API_KEY`（`$DSH_HOME/.credentials.yaml` 的 refs，
 *    热加载——每次搜索请求实时解析，改动无需重启）。
 *
 * @module @dingpenghui/dsh-web-search-serper
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-web'
import {
  SerperSearchProvider,
  SERPER_DEFAULT_BASE_URL,
} from './provider.ts'

/** 导出 Provider 标识 */
export { SERPER_PROVIDER_ID } from './provider.ts'
/** 导出默认端点 */
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

/** Cordis 插件名称（用于 loader 诊断） */
export const name = 'web-search-serper'

/** 注入的服务 */
export const inject = ['web'] as const

/**
 * 插件配置接口（全部可选——`apply` 用环境变量与常量补全默认值）。
 */
export interface Config {
  /** Serper API Key；缺省时回退到 `$SERPER_API_KEY`，再到凭证库 `SERPER_API_KEY` 引用 */
  apiKey?: string
  /** 端点基址，默认为 https://google.serper.dev（`/search` 自动追加） */
  baseURL?: string
  /** 默认国家代码，如 'us', 'cn', 'jp' */
  gl?: string
  /** 默认地区代码，如 'us'（作为 `cr` 参数发送） */
  cr?: string
  /** 默认结果数量（请求未携带 maxResults 时）；省略则不发送 */
  numResults?: number
}

/**
 * 注册 Serper 搜索提供方到 ctx.web。
 * 无 `config` 的 composition 行以 `undefined` 调用，故默认空对象。
 *
 * @param ctx - Cordis 上下文
 * @param config - 插件配置（可缺省）
 */
export function apply(ctx: Context, config: Config = {}): void {
  const provider = new SerperSearchProvider({
    apiKey: config.apiKey ?? process.env.SERPER_API_KEY ?? '',
    // 凭证库热解析（惰性）：挂载时 `credentials` 服务可能尚未就绪（各行
    // 并行挂载），故不在 apply 时捕获服务实例，而是每次搜索请求时对 ctx
    // 做实时注册表查找——注册表是 live 的，服务就绪后即可命中。
    resolveKey: async () => {
      const credentials = ctx.get('credentials')
      if (credentials === undefined) return undefined
      const resolved = await credentials.resolve('SERPER_API_KEY')
      return resolved === undefined ? undefined : resolved.value
    },
    baseURL: config.baseURL ?? SERPER_DEFAULT_BASE_URL,
    ...(config.gl !== undefined ? { gl: config.gl } : {}),
    ...(config.cr !== undefined ? { cr: config.cr } : {}),
    ...(config.numResults !== undefined ? { numResults: config.numResults } : {}),
  })

  ctx.web.registerSearchProvider(provider)
}
