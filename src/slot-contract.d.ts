/**
 * Declaration merges for this plugin's client half: the two Plugins-page
 * configuration slots it renders into and its locale namespace.
 *
 * The tables live in `./client/slots-contract.d.ts` (this plugin's copy of the
 * 0.2.0-rc.2 slot contract, since the official types are not published for
 * that line). Composing projects that DO have the official types can map these
 * same entries onto them — the keys and value shapes are identical.
 */

import type { SerperSlotOwnerProps } from './client/plugin-detail-page.tsx'

export {}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.dsh-web-search-serper':
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
  }

  interface SlotMap {
    /** 插件自己的页面配置（点击插件名进入的页面）：本插件以包名为 key。 */
    'plugins.bundle.config': { kind: 'keyed'; scope: 'root'; owner: SerperSlotOwnerProps }
    /** 插件某一行自己的配置页：本插件以 `<包名>#<行 id>` 为 key。 */
    'plugins.row.config': { kind: 'keyed'; scope: 'root'; owner: SerperSlotOwnerProps }
  }
}

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
