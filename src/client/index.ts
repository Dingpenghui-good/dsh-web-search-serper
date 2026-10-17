/**
 * Client-side entry for the dsh-web-search-serper plugin.
 *
 * Registers the plugin's configuration page — the screen opened from the
 * plugin name in the Plugins list — through the two slots the Plugins page
 * declares for other plugins:
 *
 * - `plugins.bundle.config`, keyed by the npm package name: rendered on the
 *   bundle's page under its description (`view: 'page'` only). The page decides
 *   from its configuration ledger whether that section exists at all, and it
 *   does NOT hand the bundle page a `form`, so this view renders read-only.
 * - `plugins.row.config`, keyed by `<package name>#<row id>`: rendered when the
 *   row's configure control opens the row's own page. The row page passes a
 *   `form` built from the row's `configForm(id)` (`state` + `mutate`), and this
 *   view is the editable one.
 *
 * Both registrations follow the Host's served settings namespaces through
 * `configForms.whileServed`, so a deployment that never composes the settings
 * transport shows no trace of the page. The editable page hosts the search
 * settings form: apiKey / baseURL / gl / cr / numResults, saved through the
 * row's settings form (namespace = this plugin row's entry id,
 * `web-search-serper`).
 *
 * Why the page is a plain component rather than a shared `SettingsFormModel`:
 * the editable `form` arrives as a PROPERTY of the row page's render (the page
 * owner reads `configForm(id)` itself), so the component reads `props.form.state`
 * and submits through `props.form.mutate` with precise path ops.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the ctx.locale merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'

import { SerperSearchDetailPage } from './plugin-detail-page.tsx'
import { zh as zhDict, en as enDict } from '../locales/index.ts'
// Shared barrel: keeps this bundle free of Host-only package value imports.
import {
  SERPER_SEARCH_NAMESPACE,
  SERPER_SEARCH_LOCALE_NS,
  PLUGIN_PACKAGE_NAME,
  PLUGIN_ROW_CONFIG_KEY,
} from '../shared.ts'

/** Required services: the page registers into slots and needs the locale runtime. */
export const inject = ['slots', 'locale'] as const

/**
 * Mount the Serper search settings page once the Host serves its namespace.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  // 字典按 (命名空间, 语言) 注册；重复注册会抛错，因此用 ctx.effect 声明生命周期，
  // 让插件的重载 / 卸载把两组字典一起撤掉。
  ctx.effect(
    () => ctx.locale.register(SERPER_SEARCH_LOCALE_NS, { zh: zhDict, en: enDict }),
    'serper-search: dictionaries',
  )

  // 页面只在 Host 真的在 serve 这个 settings 命名空间时出现；命名空间暂时
  // 不可用时（刚安装 / 刚更新、尚未重启）自动撤下，恢复后自动装回。
  // `configForms` 由 client ui-settings 组合；缺失时这里什么都不注册。
  const register = () => {
    const disposers: Array<() => void> = [
      ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config',
        key: PLUGIN_PACKAGE_NAME,
        locale: SERPER_SEARCH_LOCALE_NS,
      }, SerperSearchDetailPage)),
      ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
        name: 'plugins.row.config',
        key: PLUGIN_ROW_CONFIG_KEY,
        locale: SERPER_SEARCH_LOCALE_NS,
      }, SerperSearchDetailPage)),
    ]
    return () => {
      for (const dispose of disposers.reverse()) dispose()
    }
  }

  const configForms = ctx.get('configForms') as
    | { whileServed(namespaces: readonly string[], register: (served: ReadonlySet<string>) => () => void): () => void }
    | undefined
  if (configForms !== undefined && typeof configForms.whileServed === 'function') {
    ctx.effect(
      () => configForms.whileServed([SERPER_SEARCH_NAMESPACE], register),
      'serper-search: detail pages',
    )
  } else {
    // 没有 settings 传输时仍然注册：页面会显示"设置服务未就绪"的提示。
    ctx.effect(register, 'serper-search: detail pages')
  }
}
