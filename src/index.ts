/**
 * @dsh-web-search-serper
 *
 * Serper.dev 搜索提供方插件，集成到 DeepSeek Harness 的 web 能力 seam。
 *
 * 注册为 `serper` 搜索提供方，当它是唯一可用的搜索后端时，
 * `ctx.web.search()` 会自动解析到它——也可以用 `searchProvider: serper` 固定。
 *
 * @module @dingpenghui/dsh-web-search-serper
 */

import type { Context } from '@deepseek-ai/cordis'
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
export type {
  SerperSearchProviderOptions,
  SerperSearchRequest,
  SerperSearchResponse,
  SerperOrganicResult,
  SerperKnowledgeGraph,
  SerperRelatedQuestion,
  SerperError,
} from './types.ts'

/** Cordis 插件名称 */
export const name = 'web-search-serper'

/** 注入的服务 */
export const inject = ['web'] as const

/**
 * 插件配置接口
 */
export interface Config {
  /** Serper API Key，优先使用此字段；为空时回退到 $SERPER_API_KEY 环境变量 */
  apiKey?: string
  /** 端点基址，默认为 https://google.serper.dev */
  baseURL?: string
  /** 默认国家代码，如 'us', 'cn', 'jp' */
  gl?: string
  /** 默认地区代码，如 'cr=us' */
  cr?: string
  /** 默认结果数量 */
  numResults?: number
}

/**
 * 注册 Serper 搜索提供方到 ctx.web
 *
 * @param ctx - Cordis 上下文
 * @param config - 插件配置
 */
export function apply(ctx: Context, config: Config): void {
  const apiKey = config.apiKey ?? ''
  const baseURL = config.baseURL ?? SERPER_DEFAULT_BASE_URL

  const provider = new SerperSearchProvider({
    apiKey,
    baseURL,
    ...(config.gl !== undefined ? { gl: config.gl } : {}),
    ...(config.cr !== undefined ? { cr: config.cr } : {}),
    ...(config.numResults !== undefined ? { numResults: config.numResults } : {}),
  })

  // 使用 ctx.web 注册 provider
  const web = ctx.get('web')
  if (web && typeof (web as any).registerSearchProvider === 'function') {
    ;(web as any).registerSearchProvider(provider)
  }
}
