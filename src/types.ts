/**
 * 线搜类型定义 - Serper.dev API 响应格式
 */

/** Serper 搜索结果请求体 */
export interface SerperSearchRequest {
  /** 搜索查询词 */
  q: string
  /** 国家代码，如 'us', 'cn', 'jp' */
  gl?: string
  /** 地区代码，如 'cr=us' */
  cr?: string
  /** 返回结果数量，默认 10 */
  num?: number
  /** 搜索类型: search, images, news, videos, shopping, scholar, patents */
  type?: string
}

/** Serper 有机搜索结果 */
export interface SerperOrganicResult {
  /** 结果标题 */
  title: string
  /** 结果链接 */
  link: string
  /** 结果摘要 */
  snippet: string
  /** 排名位置 */
  position: number
  /** 发布日期（可选） */
  date?: string
  /** 图标 URL（可选） */
  icon?: string
}

/** 知识图谱数据（可选） */
export interface SerperKnowledgeGraph {
  /** 标题 */
  title: string
  /** 类型 */
  type?: string
  /** 官网链接 */
  website?: string
  /** 描述 */
  description?: string
  [key: string]: unknown
}

/** 相关问题（可选） */
export interface SerperRelatedQuestion {
  /** 问题文本 */
  question: string
  /** 摘要 */
  snippet: string
  /** 标题 */
  title: string
  /** 链接 */
  link: string
}

/** Serper 搜索响应 */
export interface SerperSearchResponse {
  /** 搜索参数 */
  searchParameters: Record<string, unknown>
  /** 有机搜索结果 */
  organic: SerperOrganicResult[]
  /** 知识图谱（可选） */
  knowledgeGraph?: SerperKnowledgeGraph
  /** 相关问题（可选） */
  relatedQuestions?: SerperRelatedQuestion[]
  /** 广告（可选） */
  ads?: unknown[]
  /** 总结果数（可选） */
  total?: number
  /** 消耗 credits（可选） */
  credits?: number
}

/** Serper 错误响应 */
export interface SerperError {
  /** 错误消息 */
  message?: string
  /** 错误类型 */
  error?: string
}
