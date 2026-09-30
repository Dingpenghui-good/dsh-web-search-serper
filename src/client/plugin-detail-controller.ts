/**
 * dsh-web-search-serper 详情页的 staged form：把宿主 settings 命名空间
 * （web-search-serper）桥接到插件详情页（plugins.bundle.config /
 * plugins.row.config）的保存控件。
 */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  SettingsFormModel,
  type SettingsFieldState,
  type SettingsFormActions,
  type SettingsFormScope,
  type SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SerperSearchSettings } from '../shared.ts'

/** 详情页渲染的表单状态。 */
export interface SerperSearchPageState extends SettingsFormShell {
  apiKey: SettingsFieldState
  baseURL: SettingsFieldState
  gl: SettingsFieldState
  cr: SettingsFieldState
  numResults: SettingsFieldState
}

/** 注册侧注入给详情页组件的面。 */
export interface SerperSearchPageFace extends SettingsFormActions {
  hooks: {
    /** 页面快照，渲染器绑定为 useSerperSearchPage。 */
    serperSearchPage: SnapshotStore<SerperSearchPageState>
  }
}

/** 字符串字段的 format/parse 规范：空串清除回缺省（走环境/凭证回退链）。 */
function stringFieldSpec(field: 'apiKey' | 'baseURL' | 'gl' | 'cr') {
  return {
    field,
    format: (value: unknown) => (typeof value === 'string' ? value : ''),
    parse: (text: string) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' as const }
      return { kind: 'set' as const, value: trimmed }
    },
  }
}

/** numResults 字段的 format/parse 规范：1–100 的正整数。 */
function numResultsFieldSpec() {
  return {
    field: 'numResults',
    format: (value: unknown) => (typeof value === 'number' ? String(value) : ''),
    parse: (text: string) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' as const }
      const n = Number(trimmed)
      if (!Number.isFinite(n) || n < 1 || n > 100 || !Number.isInteger(n)) return undefined
      return { kind: 'set' as const, value: n }
    },
  }
}

/** 把一个宿主 settings 命名空间桥接到详情页的 staged form。 */
function asFormScope(scope: ConfigForm<SerperSearchSettings>): SettingsFormScope<SerperSearchSettings> {
  return {
    getSnapshot: () => {
      const s = scope.getSnapshot()
      return {
        status: s.status,
        value: s.value,
        base: s.base,
        user: s.user,
        writable: s.writable,
        revision: s.revision,
      }
    },
    subscribe: (listener) => scope.subscribe(listener),
    mutate: (ops, expectedRevision) => scope.mutate(ops as never, expectedRevision),
  }
}

/** 把命名空间的 `ConfigForm` 适配为详情页的 staged form。 */
export class SerperSearchPageController {
  private readonly form: SettingsFormModel<SerperSearchSettings>
  private readonly store: SnapshotStore<SerperSearchPageState>

  /** @param scope - 共享配置表单（命名空间的 ConfigForm）。 */
  constructor(scope: ConfigForm<SerperSearchSettings>) {
    this.form = new SettingsFormModel(asFormScope(scope), [
      stringFieldSpec('apiKey'),
      stringFieldSpec('baseURL'),
      stringFieldSpec('gl'),
      stringFieldSpec('cr'),
      numResultsFieldSpec(),
    ])
    this.store = this.form.bind(() => this.projection())
  }

  private projection(): SerperSearchPageState {
    return {
      ...this.form.shell(),
      apiKey: this.form.field('apiKey'),
      baseURL: this.form.field('baseURL'),
      gl: this.form.field('gl'),
      cr: this.form.field('cr'),
      numResults: this.form.field('numResults'),
    }
  }

  /** 构建详情页 slot 注册注入的面。 */
  inject(): SerperSearchPageFace {
    return { hooks: { serperSearchPage: this.store }, ...this.form.actions() }
  }

  /** 释放表单订阅。 */
  dispose(): void {
    this.form.dispose()
  }
}
