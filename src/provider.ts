/**
 * Serper.dev-backed `WebSearchProvider`。把 Google organic 结果映射为归一化
 * sources，注册到 `ctx.web` seam，不拥有该服务。
 *
 * Serper 的 `organic[].date` 是人类可读文本（"Aug 14, 2026"、"2 days ago"），
 * 不是 ISO-8601，因此刻意不映射到 `publishedAt`（seam 文档定义为 ISO 时间戳）。
 *
 * 0.2.0-rc.2 适配：所有配置值（key / baseURL / gl / cr / numResults）通过
 * 惰性访问器读取，每次搜索时求值——宿主保存 settings 后不重激活插件 fiber，
 * 惰性读取让后续请求立即使用新值。
 *
 * @module dsh-web-search-serper/provider
 */

import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@deepseek-ai/dsh-web'
import type { SerperOrganicResult, SerperSearchResponse } from './types.ts'

/** Stable id this provider registers under. */
export const SERPER_PROVIDER_ID = 'serper'

/** Serper.dev API 默认端点 */
export const SERPER_DEFAULT_BASE_URL = 'https://google.serper.dev'

/** 归因头；随包版本更新 */
const USER_AGENT = 'dsh-web-search-serper/1.0.0'

/** Serper 的 num 上限 */
const SERPER_MAX_RESULTS = 100

/** 单次请求的惰性解析出的端点选项（key 由 search() 单独解析） */
interface RequestOptions {
  baseURL: string
  gl?: string
  cr?: string
  numResults?: number
}

/** Resolved provider options. */
export interface SerperSearchProviderOptions {
  /**
   * Per-call key resolver（config → 环境变量 → 凭证库的惰性链）。
   * 返回 key 值或 `undefined`（provider 判为不可用）。
   */
  resolveKey?: () => Promise<string | undefined>
  /**
   * 端点选项惰性访问器：每次搜索时求值 baseURL / gl / cr / numResults。
   * 缺省时 baseURL 用默认端点，无地区与数量默认。
   */
  baseURLOptions?: () => RequestOptions
}

/**
 * 将单个 Serper organic 结果映射为归一化 source。
 * 缺少可用 link 的条目被丢弃（返回 undefined）。
 */
export function mapSerperResult(result: SerperOrganicResult): WebSearchSource | undefined {
  if (result === undefined || result === null) return undefined
  const link = result.link
  if (typeof link !== 'string' || link.length === 0) return undefined
  return {
    url: link,
    ...(typeof result.title === 'string' && result.title.length > 0 ? { title: result.title } : {}),
    ...(typeof result.snippet === 'string' && result.snippet.length > 0 ? { snippet: result.snippet } : {}),
  }
}

/**
 * 将 Serper 响应映射为归一化搜索结果。
 * 无 link 的条目被丢弃；`truncated` 恒为 false（截断由 web seam 负责）。
 */
export function mapSerperResponse(response: SerperSearchResponse): WebSearchResult {
  const sources = (response.organic ?? [])
    .map(mapSerperResult)
    .filter((source): source is WebSearchSource => source !== undefined)
  return { sources, truncated: false }
}

/** Serper.dev 搜索提供方实现；HTTP 重定向失败为 `WEB_PROVIDER_ERROR`。 */
export class SerperSearchProvider implements WebSearchProvider {
  readonly id = SERPER_PROVIDER_ID

  constructor(private readonly options: SerperSearchProviderOptions) {}

  /**
   * 检查提供方是否可用（廉价判断，不发网络请求）。
   * 0.2.0-rc.2 的选择语义：配置了 serper 但 key 缺失 → UNAVAILABLE 而非
   * 执行时报错，因此这里做一次廉价的 key 预检（只读 config/环境变量，
   * 凭证库引用存在性由首次搜索兜底）。
   */
  available(): boolean {
    const opts = this.options.baseURLOptions?.() ?? { baseURL: SERPER_DEFAULT_BASE_URL }
    if (!isValidBaseUrl(opts.baseURL)) return false
    // 有惰性 resolver 即可用（真正缺 key 时 search() 抛 WEB_PROVIDER_CONFIGURED_UNAVAILABLE）
    const envKey = process.env.SERPER_API_KEY
    return this.options.resolveKey !== undefined || (envKey !== undefined && envKey.length > 0)
  }

  /**
   * 执行搜索请求。
   */
  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const key = await this.options.resolveKey?.()
    if (key === undefined || key.length === 0) {
      throw new WebError(
        'Serper search provider is configured but no API key is available — set config.apiKey, '
        + 'the SERPER_API_KEY environment variable, or a SERPER_API_KEY credential reference',
        'WEB_PROVIDER_CONFIGURED_UNAVAILABLE',
      )
    }

    const opts = this.options.baseURLOptions?.() ?? { baseURL: SERPER_DEFAULT_BASE_URL }
    const requested = request.maxResults ?? opts.numResults
    const num = requested === undefined
      ? undefined
      : Math.min(Math.max(1, Math.floor(requested)), SERPER_MAX_RESULTS)

    let response: Response
    try {
      response = await fetch(`${opts.baseURL}/search`, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'X-Api-Key': key,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          q: request.query,
          ...(opts.gl !== undefined ? { gl: opts.gl } : {}),
          ...(opts.cr !== undefined ? { cr: opts.cr } : {}),
          ...(num !== undefined ? { num: num } : {}),
        }),
        ...(signal !== undefined ? { signal } : {}),
      })
    } catch (error: unknown) {
      if (isAbortError(error)) {
        throw new WebError('Serper search aborted', 'WEB_ABORTED', { cause: error })
      }
      throw new WebError(`Serper search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }

    if (!response.ok) {
      const status = response.status
      let detail: string | undefined
      try {
        const parsed = await response.json() as { message?: unknown; statusCode?: unknown }
        if (typeof parsed.message === 'string' && parsed.message.length > 0) detail = parsed.message
      } catch {
        // 非 JSON 错误体（如网关 HTML 页），保持状态消息
      }
      if (status === 401 || status === 403) {
        throw new WebError(
          `Serper API authentication failed (HTTP ${status}) — check your API key`
          + (detail !== undefined ? `: ${detail}` : ''),
          'WEB_PROVIDER_ERROR',
        )
      }
      if (status === 429) {
        throw new WebError(
          `Serper API rate limit exceeded (HTTP 429) — wait and retry`
          + (detail !== undefined ? `: ${detail}` : ''),
          'WEB_PROVIDER_ERROR',
        )
      }
      throw new WebError(
        `Serper API error (HTTP ${status})` + (detail !== undefined ? `: ${detail}` : ''),
        'WEB_PROVIDER_ERROR',
      )
    }

    let payload: SerperSearchResponse
    try {
      payload = await response.json() as SerperSearchResponse
    } catch (error: unknown) {
      if (isAbortError(error)) {
        throw new WebError('Serper search aborted', 'WEB_ABORTED', { cause: error })
      }
      throw new WebError(
        `Serper returned an unprocessable response body: ${String(error)}`,
        'WEB_PROVIDER_ERROR',
        { cause: error },
      )
    }
    return mapSerperResponse(payload)
  }
}

/** 检查 base URL 是否合法 */
function isValidBaseUrl(baseURL: string): boolean {
  try {
    new URL(baseURL)
    return true
  } catch {
    return false
  }
}

/** 检查是否为中止错误（Node fetch 抛 DOMException AbortError） */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
