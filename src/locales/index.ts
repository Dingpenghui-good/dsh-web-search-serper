/**
 * Localization dictionaries shared by both halves:
 * - Host 侧：区分为 README / 诊断用的展示文案；
 * - Client 侧：详情页与表单的全部文案。
 *
 * 键的联合类型见 `src/shared.ts` 的 `SerperLocaleKey`，注册时缺键 / 多键
 * 都会是编译错误。
 */
export const zh = {
  "title": "Serper 搜索设置",
  "description": "使用 Serper.dev（Google 搜索 API）为 web_search 提供结果；Serper 不可用时自动降级到其它搜索后端。",
  "page.apiKey.label": "API Key",
  "page.apiKey.hint": "留空时按 环境变量 $SERPER_API_KEY → 凭证库 SERPER_API_KEY 引用 顺序解析。",
  "page.baseURL.label": "端点基址",
  "page.baseURL.hint": "默认 https://google.serper.dev，/search 自动追加。",
  "page.gl.label": "国家代码（gl）",
  "page.gl.hint": "如 us、cn、jp；省略则跟随 Serper 默认。",
  "page.cr.label": "地区代码（cr）",
  "page.cr.hint": "如 us；作为 cr 参数发送。",
  "page.numResults.label": "默认结果数量",
  "page.numResults.hint": "请求未携带 maxResults 时使用的默认值，1–100；省略则不发送 num。",
  "page.readOnlyHint": "此处的改动不会立即保存：请在插件行的「配置」页中修改并保存。",
  "form.unavailable": "该插件刚安装或刚更新，设置服务尚未就绪。请重启 DeepSeek Harness，重启后即可在此配置。",
  "form.readOnly": "本部署的设置为只读。",
  "form.saveFailed": "保存未被接受，已保留供你修改。",
  "form.save": "保存",
  "form.saving": "保存中…",
} as const

export const en = {
  "title": "Serper search settings",
  "description": "Serves web_search results through Serper.dev (Google Search API), falling back to another search backend when Serper is unavailable.",
  "page.apiKey.label": "API Key",
  "page.apiKey.hint": "When empty, the key resolves from the SERPER_API_KEY environment variable, then a SERPER_API_KEY credential reference.",
  "page.baseURL.label": "Endpoint base URL",
  "page.baseURL.hint": "Defaults to https://google.serper.dev; /search is appended.",
  "page.gl.label": "Country code (gl)",
  "page.gl.hint": "e.g. us, cn, jp; omitted sends Serper's default.",
  "page.cr.label": "Region code (cr)",
  "page.cr.hint": "e.g. us; sent as the cr parameter.",
  "page.numResults.label": "Default result count",
  "page.numResults.hint": "Used when the request omits maxResults, 1–100; omitted sends no num.",
  "page.readOnlyHint": "Changes here are not saved immediately: edit and save them on the row's configure page.",
  "form.unavailable": "This plugin was just installed or updated, so its settings service is not ready yet. Restart DeepSeek Harness; the form will be available here after restart.",
  "form.readOnly": "This deployment stores settings read-only.",
  "form.saveFailed": "The deployment did not accept these values; they were left for you to correct.",
  "form.save": "Save",
  "form.saving": "Saving…",
} as const
