/**
 * Shared constants usable by both the Host bundle and the Client bundle.
 * The client reads the settings namespace through this barrel so it never
 * value-imports a Host-only package.
 */

/**
 * Settings namespace = the profile entry id of this plugin row
 * (`cordis.patch.yml` 里的 `id`）。Host 侧 `ctx.settings.describe()` 与 Client 侧
 * 插件页的 `configForm(ns)` 都按这个 id 寻址。
 */
export const SERPER_SEARCH_NAMESPACE = 'web-search-serper'

/** npm 包名：`plugins.bundle.config` slot 的 key。 */
export const PLUGIN_PACKAGE_NAME = '@dingpenghui/dsh-web-search-serper'

/** `plugins.row.config` slot 的 key：`<package>#<row id>`。 */
export const PLUGIN_ROW_CONFIG_KEY = `${PLUGIN_PACKAGE_NAME}#${SERPER_SEARCH_NAMESPACE}`

/** 详情页 locale 命名空间。 */
export const SERPER_SEARCH_LOCALE_NS = 'settings.dsh-web-search-serper'

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

/** locale 字典键（与 `src/locales/index.ts` 的 zh/en 一一对应）。 */
export type SerperLocaleKey =
  | 'title'
  | 'description'
  | 'page.apiKey.label'
  | 'page.apiKey.hint'
  | 'page.baseURL.label'
  | 'page.baseURL.hint'
  | 'page.gl.label'
  | 'page.gl.hint'
  | 'page.cr.label'
  | 'page.cr.hint'
  | 'page.numResults.label'
  | 'page.numResults.hint'
  | 'page.readOnlyHint'
  | 'form.unavailable'
  | 'form.readOnly'
  | 'form.saveFailed'
  | 'form.save'
  | 'form.saving'

/** 详情页渲染的一个字段描述（Host 与 Client 共用，避免两边各写一份）。 */
export interface SerperFieldDescriptor {
  /** 命名空间里的字段名 */
  key: 'apiKey' | 'baseURL' | 'gl' | 'cr' | 'numResults'
  /** 标签文案键 */
  label: SerperLocaleKey
  /** 说明文案键 */
  hint: SerperLocaleKey
  /** 是否密文输入 */
  secret: boolean
  /** 是否数字输入 */
  numeric: boolean
  /** 占位文案 */
  placeholder: string
}

/** 详情页字段顺序。 */
export const SERPER_SETTINGS_FIELDS: readonly SerperFieldDescriptor[] = [
  { key: 'apiKey', label: 'page.apiKey.label', hint: 'page.apiKey.hint', secret: true, numeric: false, placeholder: '••••••••' },
  { key: 'baseURL', label: 'page.baseURL.label', hint: 'page.baseURL.hint', secret: false, numeric: false, placeholder: 'https://google.serper.dev' },
  { key: 'gl', label: 'page.gl.label', hint: 'page.gl.hint', secret: false, numeric: false, placeholder: 'cn' },
  { key: 'cr', label: 'page.cr.label', hint: 'page.cr.hint', secret: false, numeric: false, placeholder: 'us' },
  { key: 'numResults', label: 'page.numResults.label', hint: 'page.numResults.hint', secret: false, numeric: true, placeholder: '10' },
] as const
