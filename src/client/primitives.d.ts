/**
 * The platform primitives this plugin renders with, declared locally because
 * `@deepseek-ai/dsh-client-ui-primitives@0.2.0-rc.2` ships JavaScript without
 * type declarations. The shapes below mirror what the shipped implementations
 * read (`lib/index.js`: `SettingsValueField`, `SettingsFormModel`).
 */

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type * as React from 'react'
  import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'

  /** One section field's stored value ↔ draft text conversion. */
  export interface SettingsFieldSpec {
    /** Field name inside the namespace section. */
    readonly field: string
    /** Render a stored value as draft text ('' when the section carries none). */
    readonly format: (value: unknown) => string
    /** The write this draft stages, or undefined when the text is not accepted. */
    readonly parse: (text: string) => { kind: 'set'; value: unknown } | { kind: 'clear' } | undefined
  }

  /** One control's state as the page renders it. */
  export interface SettingsFieldState {
    /** Draft text the control renders. */
    readonly text: string
    /** Whether saving would leave a user-layer entry for this field. */
    readonly overridden: boolean
    /** Whether the draft is not a value this field accepts (blocks saving). */
    readonly invalid: boolean
  }

  /** Form state every plugin card shares. */
  export interface SettingsFormShell {
    /** False while the namespace is not served to this client. */
    readonly available: boolean
    /** Whether the Host document accepts writes. */
    readonly writable: boolean
    /** Whether the form holds edits a save would write. */
    readonly dirty: boolean
    /** Whether any staged draft is invalid, which blocks the save. */
    readonly invalid: boolean
    /** Whether a save is crossing the wire. */
    readonly saving: boolean
    /** Whether the last save did not land as staged. */
    readonly failed: boolean
  }

  /** The staged form's write actions. */
  export interface SettingsFormActions {
    /** Stage draft text for one field. */
    edit: (field: string, text: string) => void
    /** Stage a clear so saving lets the field re-inherit the composition layer. */
    resetField: (field: string) => void
    /** Write every staged edit, then re-seed from what the Host accepted. */
    save: () => void
    /** Drop every staged edit. */
    discard: () => void
  }

  /** The Host entry's form, as the model consumes it. */
  export interface SettingsFormScopeSnapshot<T> {
    readonly status: 'loading' | 'ready' | 'unavailable'
    readonly value: T | undefined
    readonly base: unknown
    readonly user: unknown
    readonly writable: boolean
    readonly revision: number | undefined
  }

  /** Path edit carried by one save. */
  export type SettingsFormPathOp =
    | { readonly op: 'set'; readonly path: readonly string[]; readonly value: unknown }
    | { readonly op: 'unset'; readonly path: readonly string[] }

  /** Reads and the atomic write the model stages over. */
  export interface SettingsFormScope<T> {
    getSnapshot(): SettingsFormScopeSnapshot<T>
    subscribe(listener: () => void): () => void
    mutate(ops: readonly SettingsFormPathOp[], expectedRevision?: number): Promise<boolean>
  }

  /** Stages one card's edits over one settings namespace and writes them on save. */
  export class SettingsFormModel<T> {
    constructor(scope: SettingsFormScope<T>, specs: SettingsFieldSpec[], secrets?: unknown[])
    /** Publish a projection rebuilt whenever the scope or a draft changes. */
    bind<S>(project: () => S): SnapshotStore<S>
    /** The card-level state. */
    shell(): SettingsFormShell
    /** One control's state. */
    field(field: string): SettingsFieldState
    /** The edit / reset / save / discard actions bound to this form. */
    actions(): SettingsFormActions
    /** Write every staged edit, then re-seed from what the Host accepted. */
    save(): Promise<void>
    /** Release the form's accepted-value subscription. */
    dispose(): void
  }

  /** The copy the form frame renders. */
  export interface SettingsFormLabels {
    readonly unavailable: string
    readonly readOnly: string
    readonly saveFailed: string
    readonly save: string
    readonly saving: string
  }

  /** Form chrome props. */
  export interface SettingsFormProps {
    readonly labels: SettingsFormLabels
    readonly state: SettingsFormShell
    readonly onSave: () => void
    readonly onDiscard: () => void
    readonly children: React.ReactNode
  }

  /** One plugin's settings form: read-only notice, controls, and the save. */
  export const SettingsForm: React.ComponentType<SettingsFormProps>

  /** One labelled text/number control of a settings page. */
  export interface SettingsValueFieldProps {
    readonly id: string
    readonly label: string
    readonly hint?: string
    readonly text: string
    readonly invalid?: boolean
    readonly overridden?: boolean
    readonly overriddenLabel?: string
    readonly resetLabel?: string
    readonly invalidLabel?: string
    readonly numeric?: boolean
    readonly disabled?: boolean
    readonly placeholder?: string
    readonly onEdit: (text: string) => void
    readonly onReset: () => void
  }

  /** Renders one labelled control. */
  export const SettingsValueField: React.ComponentType<SettingsValueFieldProps>
}
