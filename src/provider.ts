/**
 * Serper.dev-backed `WebSearchProvider`. It maps organic Google results to
 * normalized sources and registers into the `ctx.web` seam without owning
 * the service.
 *
 * Serper's `organic[].date` is human text ("Aug 14, 2026", "2 days ago"),
 * not ISO-8601, so it is deliberately not mapped to `publishedAt`, which the
 * seam documents as an ISO-8601 timestamp.
 *
 * @module @dingpenghui/dsh-web-search-serper/provider
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
const USER_AGENT = 'dsh-web-search-serper/0.3.1'

/** Serper 的 num 上限 */
const SERPER_MAX_RESULTS = 100

/** Resolved provider options (the plugin's `apply` supplies config and env-var defaults). */
export interface SerperSearchProviderOptions {
  /** Serper API key. Empty/absent makes the provider unavailable unless `resolveKey` is set. */
  apiKey: string
  /**
   * Per-call key resolver (credentials store). Consulted only when the
   * static `apiKey` is empty; resolves to a key value or `undefined`.
   */
  resolveKey?: () => Promise<string | undefined>
  /** 端点基址，`/search` 会自动追加 */
  baseURL: string
  /** 默认国家代码，如 'us', 'cn' */
  gl?: string
  /** 默认地区代码，如 'us'（发送为 `cr` 参数） */
  cr?: string
  /** 默认结果数量（当请求未携带 `maxResults` 时） */
  numResults?: number
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

/** Serper.dev 搜索提供方实现；HTTP 重定向失败为 `WEB_PROVIDER_ERROR` */
export class SerperSearchProvider implements WebSearchProvider {
  readonly id = SERPER_PROVIDER_ID

  constructor(private readonly options: SerperSearchProviderOptions) {}

  /** 检查提供方是否可用（廉价判断，不发网络请求） */
  available(): boolean {
    return isValidBaseUrl(this.options.baseURL)
      && (this.options.apiKey.length > 0 || this.options.resolveKey !== undefined)
  }

  /**
   * 执行搜索请求。
   */
  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    let key = this.options.apiKey
    if (key.length === 0 && this.options.resolveKey !== undefined) {
      try {
        key = (await this.options.resolveKey()) ?? ''
      } catch (error: unknown) {
        throw new WebError(
          `Serper search: credential lookup failed: ${String(error)}`,
          'WEB_PROVIDER_ERROR',
          { cause: error },
        )
      }
    }
    if (key.length === 0) {
      throw new WebError(
        'Serper search provider is configured but no API key is available — set config.apiKey, '
        + 'the SERPER_API_KEY environment variable, or a SERPER_API_KEY credential reference',
        'WEB_PROVIDER_CONFIGURED_UNAVAILABLE',
      )
    }

    const requested = request.maxResults ?? this.options.numResults
    const num = requested === undefined
      ? undefined
      : Math.min(Math.max(1, Math.floor(requested)), SERPER_MAX_RESULTS)

    let response: Response
    try {
      response = await fetch(`${this.options.baseURL}/search`, {
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
          ...(this.options.gl !== undefined ? { gl: this.options.gl } : {}),
          ...(this.options.cr !== undefined ? { cr: this.options.cr } : {}),
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
  return URL.canParse(baseURL)
}

/** 检查是否为中止错误（Node fetch 抛 DOMException AbortError） */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
