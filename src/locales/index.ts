/**
 * Localization dictionaries shared by both halves:
 * - Host 侧：区分为 README / 诊断用的展示文案；
 * - Client 侧：详情页与表单的全部文案。
 *
 * 键的联合类型见 `src/shared.ts` 的 `SerperLocaleKey`，注册时缺键 / 多键
 * 都会是编译错误。
 */
export const zh = {
  "title": "Serper 搜索",
  "description": "让 web_search 通过 Serper.dev（Google 搜索 API）检索；Serper 不可用时自动降级到其它搜索后端。装好即可用，无需配置。",
  "page.apiKey.label": "API Key",
  "page.apiKey.hint": "留空时按 环境变量 $SERPER_API_KEY → 凭证库 SERPER_API_KEY 引用 顺序解析。",
  "page.readOnlyHint": "此页为只读总览。要修改 API Key，请返回「插件」列表，在该插件行上点击「配置」进入可编辑的设置页。",
  "form.unavailable": "该插件刚安装或刚更新，设置服务尚未就绪。请重启 DeepSeek Harness，重启后即可在此配置。",
  "form.readOnly": "本部署的设置为只读。",
  "form.saveFailed": "保存未被接受，已保留供你修改。",
  "form.save": "保存",
  "form.saving": "保存中…",
} as const

export const en = {
  "title": "Serper search",
  "description": "Serves web_search results through Serper.dev (Google Search API), falling back to another search backend when Serper is unavailable. Works right after install — no configuration needed.",
  "page.apiKey.label": "API Key",
  "page.apiKey.hint": "When empty, the key resolves from the SERPER_API_KEY environment variable, then a SERPER_API_KEY credential reference.",
  "page.readOnlyHint": "This page is a read-only overview. To change the API key, go back to the Plugins list and open this row's Configure page.",
  "form.unavailable": "This plugin was just installed or updated, so its settings service is not ready yet. Restart DeepSeek Harness; the form will be available here after restart.",
  "form.readOnly": "This deployment stores settings read-only.",
  "form.saveFailed": "The deployment did not accept these values; they were left for you to correct.",
  "form.save": "Save",
  "form.saving": "Saving…",
} as const
