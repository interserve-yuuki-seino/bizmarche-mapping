import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { FormulaWorkspaceHandle } from '../formula/blockly/workspace'

export type FormulaBuilderCommitDetail = {
  formula: string
}

@customElement('bm-formula-builder')
export class FormulaBuilder extends LitElement {
  /** 編集対象の初期 formula */
  @property({ type: String })
  formula = ''

  /** Entity 項目名（ドロップダウン候補） */
  @property({ attribute: false })
  fieldNames: string[] = []

  @state() private loadError: string | null = null
  @state() private previewFormula = ''
  @state() private busy = false

  private _host?: HTMLElement
  private _handle?: FormulaWorkspaceHandle
  private _open = false
  private _wsChangeBound = false

  /** モーダルを開く */
  async open(initialFormula?: string): Promise<void> {
    if (initialFormula !== undefined) {
      this.formula = initialFormula
    }
    this._open = true
    this.loadError = null
    this.requestUpdate()
    await this.updateComplete
    await this.mountWorkspace()
  }

  close(): void {
    this._open = false
    this.disposeWorkspace()
    this.requestUpdate()
  }

  private disposeWorkspace(): void {
    this._wsChangeBound = false
    this._handle?.dispose()
    this._handle = undefined
    if (this._host) {
      this._host.replaceChildren()
      this._host = undefined
    }
  }

  private async mountWorkspace(): Promise<void> {
    this.disposeWorkspace()
    const mount = this.renderRoot.querySelector(
      '#blockly-mount',
    ) as HTMLElement | null
    if (!mount) return

    this.busy = true
    this.loadError = null

    try {
      const { createFormulaWorkspace } = await import(
        '../formula/blockly/workspace'
      )
      await import('blockly/blocks')

      this._host = mount
      const handle = await createFormulaWorkspace(mount, {
        fieldNames: this.fieldNames,
        initialFormula: this.formula,
      })
      this._handle = handle

      if (this.formula.trim()) {
        const loadResult = handle.loadFormula(this.formula.trim())
        if (!loadResult.ok) {
          this.loadError = loadResult.error
        }
      }
      this.previewFormula = handle.getFormula()
      this.bindWorkspaceChangeListener()
    } catch (e) {
      this.loadError =
        e instanceof Error ? e.message : 'Blockly の読み込みに失敗しました'
    } finally {
      this.busy = false
    }
  }

  private onWorkspaceChange(): void {
    if (this._handle) {
      this.previewFormula = this._handle.getFormula()
    }
  }

  private commit(): void {
    const formula = this._handle?.getFormula() ?? this.previewFormula
    this.dispatchEvent(
      new CustomEvent<FormulaBuilderCommitDetail>('formula-commit', {
        bubbles: true,
        composed: true,
        detail: { formula },
      }),
    )
    this.close()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.disposeWorkspace()
  }

  override render() {
    if (!this._open) return html``

    return html`
      <div class="overlay" @click=${this.onOverlayClick}>
        <div
          class="panel"
          role="dialog"
          aria-labelledby="formula-builder-title"
          @click=${(e: Event) => e.stopPropagation()}
        >
          <header class="header">
            <h2 id="formula-builder-title">数式ビルダー</h2>
            <button type="button" class="icon-btn" @click=${this.close}>
              閉じる
            </button>
          </header>

          ${this.loadError
            ? html`<p class="error">${this.loadError}</p>`
            : null}
          ${this.busy
            ? html`<p class="hint">Blockly を読み込み中…</p>`
            : null}

          <div
            id="blockly-mount"
            class="mount"
            @pointerdown=${(e: Event) => e.stopPropagation()}
          ></div>

          <footer class="footer">
            <label class="preview">
              <span class="preview-label">プレビュー</span>
              <code class="preview-code">${this.previewFormula || '(空)'}</code>
            </label>
            <div class="actions">
              <button type="button" class="btn secondary" @click=${this.close}>
                キャンセル
              </button>
              <button
                type="button"
                class="btn primary"
                ?disabled=${this.busy}
                @click=${this.commit}
              >
                確定
              </button>
            </div>
          </footer>
        </div>
      </div>
    `
  }

  private bindWorkspaceChangeListener(): void {
    if (!this._handle || this._wsChangeBound) return
    this._handle.workspace.addChangeListener(() => this.onWorkspaceChange())
    this._wsChangeBound = true
  }

  override updated(changed: Map<string, unknown>): void {
    super.updated(changed)
    if (!this._open || !this._handle) return
    if (changed.has('fieldNames')) {
      this._handle.setFieldNames(this.fieldNames)
    }
  }

  private onOverlayClick(e: Event): void {
    if (e.target === e.currentTarget) this.close()
  }

  static styles = css`
    :host {
      display: contents;
    }

    .overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
    }

    .panel {
      display: flex;
      flex-direction: column;
      width: min(960px, 100%);
      max-height: min(90vh, 800px);
      background: #f9fafb;
      border-radius: 10px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      background: #fff;
    }

    .header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #111827;
    }

    .icon-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 13px;
      color: #4b5563;
      padding: 4px 8px;
    }

    .error {
      margin: 8px 16px 0;
      color: #b91c1c;
      font-size: 13px;
    }

    .hint {
      margin: 8px 16px 0;
      color: #6b7280;
      font-size: 13px;
    }

    .mount {
      flex: 1;
      min-height: 360px;
      margin: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #fff;
    }

    .footer {
      padding: 12px 16px;
      border-top: 1px solid #e5e7eb;
      background: #fff;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .preview {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .preview-label {
      font-size: 11px;
      color: #6b7280;
    }

    .preview-code {
      font-size: 12px;
      word-break: break-all;
      background: #f3f4f6;
      padding: 6px 8px;
      border-radius: 4px;
      color: #111827;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .btn {
      font-size: 13px;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid #d1d5db;
    }

    .btn.secondary {
      background: #fff;
      color: #374151;
    }

    .btn.primary {
      background: #2563eb;
      color: #fff;
      border-color: #2563eb;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'bm-formula-builder': FormulaBuilder
  }
}
