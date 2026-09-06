/**
 * SerperSearchProvider - Serper.dev Google Search API 提供方
 *
 * 将 Serper.dev 搜索结果映射为 DSH web 能力 seam 的标准化格式。
 */

import type { WebSearchProvider, WebSearchRequest, WebSearchResult, WebSearchSource } from '@deepseek-ai/dsh-web'
import type { SerperError, SerperOrganicResult, SerperSearchResponse } from './types.ts'

/** 稳定标识符，用于 provider 注册 */
export const SERPER_PROVIDER_ID = 'serper'

/** Serper.dev API 默认端点 */
export const SERPER_DEFAULT_BASE_URL = 'https://google.serper.dev'

/** 请求头中的 User-Agent */
const USER_AGENT = 'dsh-web-search-serper/0.1.0'

/** 提供方配置选项 */
export interface SerperSearchProviderOptions {
  /** Serper API Key */
  apiKey: string
  /** 端点基址，/search 会自动追加 */
  baseURL: string
  /** 默认国家代码，如 'us', 'cn' */
  gl?: string
  /** 默认地区代码，如 'cr=us' */
  cr?: string
  /** 默认结果数量 */
  numResults?: number
}

/**
 * 将单个 Serper 结果映射为 WebSearchSource
 */
export function mapSerperResult(result: SerperOrganicResult): WebSearchSource {
  return {
    url: result.link,
    ...(result.title.length > 0 ? { title: result.title } : {}),
    ...(result.snippet.length > 0 ? { snippet: result.snippet } : {}),
    ...(result.date != null && result.date.length > 0 ? { publishedAt: result.date } : {}),
  }
}

/**
 * 将 Serper 响应映射为 WebSearchResult
 */
export function mapSerperResponse(response: SerperSearchResponse): WebSearchResult {
  const sources: WebSearchSource[] = (response.organic ?? []).map(mapSerperResult)
  return { sources, truncated: false }
}

/**
 * Serper.dev 搜索提供方实现
 */
export class SerperSearchProvider implements WebSearchProvider {
  /** 提供方唯一标识 */
  readonly id = SERPER_PROVIDER_ID

  constructor(private readonly options: SerperSearchProviderOptions) {}

  /** 检查提供方是否可用 */
  available(): boolean {
    return this.options.apiKey.length > 0 && isValidBaseUrl(this.options.baseURL)
  }

  /**
   * 执行搜索请求
   */
  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const numResults = request.maxResults ?? this.options.numResults
    let response: Response

    try {
      response = await fetch(`${this.options.baseURL}/search`, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'X-API-Key': this.options.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          q: request.query,
          ...(this.options.gl ? { gl: this.options.gl } : {}),
          ...(this.options.cr ? { cr: this.options.cr } : {}),
          ...(numResults !== undefined ? { num: numResults } : {}),
        }),
        ...(signal !== undefined ? { signal } : {}),
      })
    } catch (error: unknown) {
      if (isAbortError(error)) {
        throw new Error(`Serper search aborted: ${String(error)}`)
      }
      throw new Error(`Serper search request failed: ${String(error)}`)
    }

    if (!response.ok) {
      const status = response.status
      let message = `Serper API error (HTTP ${status})`

      if (status === 401 || status === 403) {
        message = 'Serper API authentication failed — check your API key'
      } else if (status === 429) {
        message = 'Serper API rate limit exceeded — please wait and retry'
      } else {
        try {
          const parsed = await response.json() as SerperError
          const detail = parsed.message ?? parsed.error
          if (detail != null && detail.length > 0) {
            message = detail
          }
        } catch {
          // 非 JSON 错误体，保持状态消息
        }
      }

      throw new Error(message)
    }

    try {
      const payload = await response.json() as SerperSearchResponse
      return mapSerperResponse(payload)
    } catch (error: unknown) {
      if (isAbortError(error)) {
        throw new Error(`Serper search aborted: ${String(error)}`)
      }
      throw new Error(`Serper returned an unprocessable response body: ${String(error)}`)
    }
  }
}

/** 检查 base URL 是否合法 */
function isValidBaseUrl(baseURL: string): boolean {
  return URL.canParse(baseURL)
}

/** 检查是否为中止错误 */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
