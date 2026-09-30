/**
 * dsh-web-search-serper 详情页：点击插件列表中的插件名字后打开的画面。
 * 展示 Serper 搜索设置（API Key / 端点 / 地区 / 结果数量）并带保存控件。
 */
import type * as React from 'react'
import type { PropsLocale, PropsRuntime, InjectFace, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { SettingsForm } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SerperSearchPageFace } from './plugin-detail-controller.ts'
import css from './PluginDetailPage.module.css'

/** 渲染器为详情页绑定的 props。 */
export type SerperSearchDetailPageProps =
  & PropsRuntime<'plugins.bundle.config'>
  & PropsLocale<'settings.dsh-web-search-serper'>
  & InjectFace<SerperSearchPageFace>

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

/**
 * 渲染详情页：一行摘要（`view: 'summary'`）或设置表单（`view: 'page'`）。
 * @param props - 视图、locale 文案、表单快照与动作。
 * @returns 摘要文字，或带保存控件的设置表单。
 */
export function SerperSearchDetailPage(props: SerperSearchDetailPageProps) {
  const { t } = props
  const state = props.useSerperSearchPage((snapshot) => snapshot)

  if (props.view === 'summary') {
    return t('description')
  }

  const disabled = !state.writable
  const apiKey = state.apiKey
  const baseURL = state.baseURL
  const gl = state.gl
  const cr = state.cr
  const numResults = state.numResults

  return (
    <SettingsForm labels={formLabels(t)} state={state} onSave={props.save} onDiscard={props.discard}>
      <div className={css.page}>
        <div className={css.hint}>{t('page.apiKey.hint')}</div>

        <div className={css.field}>
          <div className={css.fieldText}>
            <div className={css.title}>{t('page.apiKey.label')}</div>
          </div>
          <input
            type="password"
            autoComplete="off"
            className={css.input}
            value={apiKey.text}
            placeholder="••••••••"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              props.edit('apiKey', e.target.value)
            }}
            disabled={disabled}
          />
        </div>

        <div className={css.field}>
          <div className={css.fieldText}>
            <div className={css.title}>{t('page.baseURL.label')}</div>
            <div className={css.subHint}>{t('page.baseURL.hint')}</div>
          </div>
          <input
            type="text"
            className={css.input}
            value={baseURL.text}
            placeholder="https://google.serper.dev"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              props.edit('baseURL', e.target.value)
            }}
            disabled={disabled}
          />
        </div>

        <div className={css.fieldRow}>
          <div className={css.field}>
            <div className={css.fieldText}>
              <div className={css.title}>{t('page.gl.label')}</div>
              <div className={css.subHint}>{t('page.gl.hint')}</div>
            </div>
            <input
              type="text"
              className={css.inputSmall}
              value={gl.text}
              placeholder="cn"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                props.edit('gl', e.target.value)
              }}
              disabled={disabled}
            />
          </div>
          <div className={css.field}>
            <div className={css.fieldText}>
              <div className={css.title}>{t('page.cr.label')}</div>
              <div className={css.subHint}>{t('page.cr.hint')}</div>
            </div>
            <input
              type="text"
              className={css.inputSmall}
              value={cr.text}
              placeholder="us"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                props.edit('cr', e.target.value)
              }}
              disabled={disabled}
            />
          </div>
        </div>

        <div className={css.field}>
          <div className={css.fieldText}>
            <div className={css.title}>{t('page.numResults.label')}</div>
            <div className={css.subHint}>{t('page.numResults.hint')}</div>
          </div>
          <input
            type="text"
            inputMode="numeric"
            className={css.inputSmall}
            value={numResults.text}
            placeholder="10"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              props.edit('numResults', e.target.value)
            }}
            disabled={disabled}
          />
        </div>
      </div>
    </SettingsForm>
  )
}
