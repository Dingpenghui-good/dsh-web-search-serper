/**
 * dsh-web-search-serper 的配置页：插件页（点击插件名）与行配置页共用一个组件。
 *
 * 0.2.0-rc.2 插件页的真实渲染方式决定了两种视图：
 * - `plugins.bundle.config` 只渲染 `view: 'page'`，且**不传 `form`**；
 * - `plugins.row.config` 先渲染 `view: 'summary'`（行描述兜底），再渲染
 *   `view: 'page'` 并传入行自己的 `form`（`getSnapshot` + `mutate`）。
 *
 * 因此有 `form` 时渲染可编辑的设置表单（经宿主 `mutate` 原子保存），
 * 没有 `form` 时按只读快照展示，并提示去行的「配置」页修改。
 */
import * as React from 'react'
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import {
  SettingsForm,
  SettingsFormModel,
  SettingsValueField,
  type SettingsFieldSpec,
  type SettingsFormScope,
  type SettingsFormShell,
  type SettingsFieldState,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { SERPER_SETTINGS_FIELDS, type SerperFieldDescriptor, type SerperSearchSettings } from '../shared.ts'
import css from './PluginDetailPage.module.css'

/** 行配置页传入的表单面（与插件页 `configForm(id)` 的返回一致）。 */
export interface SerperPageForm {
  /** 已接受的 Host 值。 */
  readonly state: {
    readonly status?: 'loading' | 'ready' | 'unavailable'
    readonly value?: unknown
    readonly writable?: boolean
    readonly revision?: number
  }
  /** 以一次原子写入提交路径编辑。 */
  readonly mutate: (
    ops: readonly ({ op: 'set'; path: readonly string[]; value: unknown } | { op: 'unset'; path: readonly string[] })[],
    expectedRevision?: number,
  ) => Promise<boolean>
}

/** 渲染器为详情页绑定的 props。 */
export type SerperSearchDetailPageProps = PropsRuntime<'plugins.bundle.config'>
  & PropsLocale<'settings.dsh-web-search-serper'>
  & { readonly form?: SerperPageForm | undefined }

/** 页面渲染的状态：表单壳 + 每个字段的草稿。 */
interface SerperPageState extends SettingsFormShell {
  readonly fields: Record<string, SettingsFieldState>
}

/** 字符串字段：空串表示清除（回落到环境变量 / 凭证库）。 */
function textSpec(field: string): SettingsFieldSpec {
  return {
    field,
    format: (value) => (typeof value === 'string' ? value : ''),
    parse: (text) => {
      const trimmed = text.trim()
      return trimmed === '' ? { kind: 'clear' } : { kind: 'set', value: trimmed }
    },
  }
}

/** numResults：1–100 的整数，空串清除。 */
function numberSpec(field: string): SettingsFieldSpec {
  return {
    field,
    format: (value) => (typeof value === 'number' ? String(value) : ''),
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100 || !Number.isInteger(parsed)) return undefined
      return { kind: 'set', value: parsed }
    },
  }
}

/** 把行配置页传进来的 `form` 适配成 `SettingsFormModel` 的 scope。 */
function asScope(form: SerperPageForm): SettingsFormScope<SerperSearchSettings> {
  const snapshot = () => {
    const state = form.state
    const value = state.value
    return {
      status: state.status ?? 'ready',
      value: (value !== null && typeof value === 'object' ? value : undefined) as SerperSearchSettings | undefined,
      base: undefined,
      user: undefined,
      writable: state.writable !== false,
      revision: state.revision,
    }
  }
  return {
    getSnapshot: snapshot,
    // 属性每次都从 props 读（页面重建时 form 会换新对象），这里按需拉取。
    subscribe: () => () => {},
    mutate: (ops, expectedRevision) => form.mutate(ops, expectedRevision),
  }
}

/** 创建一次页面状态的 staged 表单。 */
function createPage(form: SerperPageForm) {
  const specs: SettingsFieldSpec[] = SERPER_SETTINGS_FIELDS.map((field) =>
    field.key === 'numResults' ? numberSpec(field.key) : textSpec(field.key))
  const model = new SettingsFormModel<SerperSearchSettings>(asScope(form), specs)
  const project = (): SerperPageState => ({
    ...model.shell(),
    fields: Object.fromEntries(SERPER_SETTINGS_FIELDS.map((f) => [f.key, model.field(f.key)])),
  })
  const store: SnapshotStore<SerperPageState> = model.bind(project)
  return { model, store }
}

/** 从 locale 字典派生 SettingsForm 的标签文案。 */
function formLabels(t: TranslateNS<'settings.dsh-web-search-serper'>) {
  return {
    unavailable: t('form.unavailable'),
    readOnly: t('form.readOnly'),
    saveFailed: t('form.saveFailed'),
    save: t('form.save'),
    saving: t('form.saving'),
  }
}

/** 只读快照里读一个字段的展示值。 */
function displayValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/**
 * 渲染详情页：一行摘要（`view: 'summary'`）或设置页（`view: 'page'`）。
 * @param props - 视图、locale 文案、可选的行配置表单。
 * @returns 摘要文字，或设置页。
 */
export function SerperSearchDetailPage(props: SerperSearchDetailPageProps) {
  const { t } = props

  if (props.view === 'summary') return t('description')

  const form = props.form
  const labels = formLabels(t)

  // 插件页（bundle 配置区）不带 form：只读快照，指引到行的配置页。
  if (form === undefined) {
    // 插件页拿不到行配置表单，因此没有可信的来源可展示；此处保持为空快照，
    // 由下方 readOnlyHint 明确指引用户到「行配置页」编辑。
    const section: Record<string, unknown> = {}
    return (
      <div className={css.page}>
        <div className={css.hint} role="note">{t('page.readOnlyHint')}</div>
        {SERPER_SETTINGS_FIELDS.map((field: SerperFieldDescriptor) => (
          <div className={css.field} key={field.key}>
            <div className={css.fieldText}>
              <span className={css.title}>{t(field.label)}</span>
              <span className={css.subHint}>{t(field.hint)}</span>
            </div>
            <input
              className={field.numeric ? css.inputSmall : css.input}
              type={field.secret ? 'password' : 'text'}
              // 占位符在此处会伪装成「已填值」，对 secret 字段尤其误导（用户会
              // 以为 key 已配置）。只读视图一律不显示占位文案。
              value={displayValue(section[field.key])}
              readOnly
              disabled
              aria-disabled
            />
          </div>
        ))}
      </div>
    )
  }

  return <SerperSettingsForm t={t} form={form} labels={labels} />
}

/** 一个稳定的 React 组件：只在 form 变化时重建 staged 表单。 */
function SerperSettingsForm(props: {
  readonly t: TranslateNS<'settings.dsh-web-search-serper'>
  readonly form: SerperPageForm
  readonly labels: ReturnType<typeof formLabels>
}) {
  const [page, setPage] = React.useState(() => createPage(props.form))
  React.useEffect(() => {
    const next = createPage(props.form)
    setPage(next)
    return () => { next.model.dispose() }
  }, [props.form])

  const state = page.model.shell()
  const actions = page.model.actions()

  if (!state.available) {
    return <p className={css.hint} role="status">{props.labels.unavailable}</p>
  }

  return (
    <SettingsForm
      labels={props.labels}
      state={state}
      onSave={actions.save}
      onDiscard={actions.discard}
    >
      <div className={css.page}>
        {SERPER_SETTINGS_FIELDS.map((field) => (
          <SettingsValueField
            key={field.key}
            id={`serper-${field.key}`}
            label={props.t(field.label)}
            hint={props.t(field.hint)}
            numeric={field.numeric}
            disabled={!state.writable}
            placeholder={field.placeholder}
            {...page.model.field(field.key)}
            onEdit={(text: string) => { actions.edit(field.key, text) }}
            onReset={() => { actions.resetField(field.key) }}
          />
        ))}
      </div>
    </SettingsForm>
  )
}

/** 重新导出，便于 README / 测试引用页面状态形状。 */
export type { SerperPageState }
