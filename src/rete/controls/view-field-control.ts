import { LitElement, css, html, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { ClassicPreset } from 'rete'
import type { ViewFieldPatch } from '../../mapping/view-field-state'

export type ViewFieldControlPayload = {
  kind: 'viewFieldControl'
  viewFieldId: string
  fieldName: string
  formula: string
  overrideFieldName: boolean
  /** syncViewFields 時に増やして Lit を再描画 */
  syncRevision?: number
  onPatch: (patch: ViewFieldPatch) => void
}

@customElement('bm-view-field-control')
export class ViewFieldControl extends LitElement {
  @property({ type: String })
  viewFieldId = ''

  @property({ type: String })
  fieldName = ''

  @property({ type: String })
  formula = ''

  @property({ type: Boolean })
  overrideFieldName = false

  @property({ attribute: false })
  onPatch!: (patch: ViewFieldPatch) => void

  @property({ type: Number })
  syncRevision = 0

  @state() private _fieldName = ''
  @state() private _formula = ''

  /** 外部からプロパティが変わったとき入力表示を同期 */
  override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('fieldName') ||
      changed.has('formula') ||
      changed.has('syncRevision')
    ) {
      this._fieldName = this.fieldName
      this._formula = this.formula
    }
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this._fieldName = this.fieldName
    this._formula = this.formula
  }

  /** 親で Blockly 数式ビルダーを開く */
  private openFormulaBuilder(): void {
    this.dispatchEvent(
      new CustomEvent<{ viewFieldId: string; formula: string }>(
        'open-formula-builder',
        {
          bubbles: true,
          composed: true,
          detail: {
            viewFieldId: this.viewFieldId,
            formula: this._formula,
          },
        },
      ),
    )
  }

  render() {
    return html`
      <div class="root" @pointerdown=${(e: Event) => e.stopPropagation()}>
        <label class="row">
          <span class="label">fieldName</span>
          <input
            class="text"
            .value=${this._fieldName}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value
              this._fieldName = v
              this.onPatch({
                id: this.viewFieldId,
                fieldName: v,
                overrideFieldName: true,
              })
            }}
            placeholder="出力項目名"
          />
        </label>
        <label class="row">
          <span class="label">formula</span>
          <div class="formula-row">
            <input
              class="text"
              .value=${this._formula}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value
                this._formula = v
                this.onPatch({ id: this.viewFieldId, formula: v })
              }}
              placeholder="entity フィールド名または式"
            />
            <button
              type="button"
              class="fx"
              title="ブロックで数式を編集"
              @click=${() => this.openFormulaBuilder()}
            >
              fx
            </button>
          </div>
        </label>
      </div>
    `
  }

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      width: 100%;
      max-width: 100%;
    }

    .root {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      padding: 4px 0;
    }

    .row {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .label {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.92);
    }

    .text {
      display: block;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      font-size: 12px;
      padding: 4px 6px;
      border: 1px solid #9ca3af;
      border-radius: 4px;
      background: #ffffff;
      color: #16171d;
    }

    .text::placeholder {
      color: #6b7280;
    }

    .formula-row {
      display: flex;
      gap: 4px;
      align-items: stretch;
      min-width: 0;
    }

    .formula-row .text {
      flex: 1;
      min-width: 0;
    }

    .fx {
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 600;
      padding: 0 8px;
      border: 1px solid #9ca3af;
      border-radius: 4px;
      background: #eef2ff;
      color: #3730a3;
      cursor: pointer;
    }

    .fx:hover {
      background: #e0e7ff;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'bm-view-field-control': ViewFieldControl
  }
}

/** Rete 用カスタム Control（lit-plugin が確実に識別できるようクラス化） */
export class ReteViewFieldControl extends ClassicPreset.Control {
  readonly kind = 'viewFieldControl' as const

  viewFieldId: string
  fieldName: string
  formula: string
  overrideFieldName: boolean
  syncRevision: number
  onPatch: (patch: ViewFieldPatch) => void

  constructor(payload: Omit<ViewFieldControlPayload, 'kind'>) {
    super()
    this.viewFieldId = payload.viewFieldId
    this.fieldName = payload.fieldName
    this.formula = payload.formula
    this.overrideFieldName = payload.overrideFieldName
    this.syncRevision = payload.syncRevision ?? 0
    this.onPatch = payload.onPatch
  }
}

export function isReteViewFieldControl(
  payload: unknown,
): payload is ReteViewFieldControl {
  return payload instanceof ReteViewFieldControl
}

/** rete Control として登録 */
export function asViewFieldControl(
  payload: Omit<ViewFieldControlPayload, 'kind'>,
): ReteViewFieldControl {
  return new ReteViewFieldControl(payload)
}
