/**
 * Shared constants usable by both the Host bundle and the Client bundle.
 * The client reads the settings namespace through this barrel so it never
 * value-imports a Host-only package.
 */

/** The settings namespace is the profile entry id of this plugin row (cordis.yml `id`). */
export const SERPER_SEARCH_NAMESPACE = 'web-search-serper'

/** npm 包名：`plugins.bundle.config` slot 的 key。 */
export const PLUGIN_PACKAGE_NAME = '@dingpenghui/dsh-web-search-serper'

/** `plugins.row.config` slot 的 key：`<package>#<row id>`。 */
export const PLUGIN_ROW_CONFIG_KEY = `${PLUGIN_PACKAGE_NAME}#${SERPER_SEARCH_NAMESPACE}`

/** 详情页编辑的字段 —— 命名空间 schema 的子集。 */
export interface SerperSearchSettings {
  /** Serper API Key（secret；缺省走 $SERPER_API_KEY / 凭证库 SERPER_API_KEY） */
  apiKey?: string
  /** 端点基址，默认 https://google.serper.dev */
  baseURL?: string
  /** 国家代码，如 'us', 'cn', 'jp' */
  gl?: string
  /** 地区代码，如 'us'（发送为 cr 参数） */
  cr?: string
  /** 默认结果数量（请求未携带 maxResults 时），上限 100 */
  numResults?: number
}
