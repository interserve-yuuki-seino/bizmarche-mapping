import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { FormulaWorkspaceHandle } from '../formula/blockly/workspace'
import {
  ensureBlocklyPopupZIndex,
  mirrorBlocklyStyles,
  scheduleRelayoutFormulaWorkspace,
  waitForElementSize,
} from '../formula/blockly/workspace-layout'

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
  /** iif の条件など、shadow のみで未完成のとき false */
  @state() private formulaComplete = true

  private _host?: HTMLElement
  private _handle?: FormulaWorkspaceHandle
  private _open = false
  private _wsChangeBound = false
  private _resizeObserver?: ResizeObserver

  /** モーダルを開く */
  async open(initialFormula?: string): Promise<void> {
    if (initialFormula !== undefined) {
      this.formula = initialFormula
    }
    this._open = true
    this.loadError = null
    this.previewFormula = this.formula.trim()
    this.formulaComplete = true
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
    this._resizeObserver?.disconnect()
    this._resizeObserver = undefined
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
      await waitForElementSize(mount)

      const { createFormulaWorkspace } = await import(
        '../formula/blockly/workspace'
      )
      await import('blockly/blocks')

      this._host = mount
      const handle = await createFormulaWorkspace(mount, {
        fieldNames: this.fieldNames,
      })
      this._handle = handle

      // Blockly の CSS は document.head にしか入らず Shadow DOM へ届かないため複製する
      if (this.renderRoot instanceof ShadowRoot) {
        mirrorBlocklyStyles(this.renderRoot)
      }
      // body 直下に描画される選択リストをモーダルより前面へ
      ensureBlocklyPopupZIndex()
      handle.resize()

      const trimmed = this.formula.trim()
      if (trimmed) {
        const loadResult = handle.loadFormula(trimmed)
        if (!loadResult.ok) {
          this.loadError = loadResult.error
          this.previewFormula = trimmed
        } else {
          this.previewFormula = handle.getFormula() || trimmed
        }
      } else {
        this.previewFormula = ''
      }
      this.formulaComplete = handle.isComplete()
      this.bindWorkspaceChangeListener()
      this.bindResizeObserver(mount, handle)
      // 接続・描画完了後に中央へ（即時 relayout だと 0,0 張り付きのままになる）
      scheduleRelayoutFormulaWorkspace(handle.workspace)
    } catch (e) {
      this.loadError =
        e instanceof Error ? e.message : 'Blockly の読み込みに失敗しました'
      this.previewFormula = this.formula.trim()
    } finally {
      this.busy = false
    }
  }

  private onWorkspaceChange(): void {
    if (!this._handle) return
    this.previewFormula = this._handle.getFormula()
    this.formulaComplete = this._handle.isComplete()
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
            ? html`
                <p class="error">${this.loadError}</p>
                <p class="error-hint">
                  ViewField の formula テキスト欄から直接編集できます。
                </p>
              `
            : null}
          ${this.busy
            ? html`<p class="hint">Blockly を読み込み中…</p>`
            : html`
                <p class="guide">
                  左からブロックをドラッグし、くぼみにはめ込みます。うっすら表示は見本（編集不可）です。
                </p>
              `}

          <div id="blockly-mount" class="mount"></div>

          <footer class="footer">
            <label class="preview">
              <span class="preview-label">プレビュー</span>
              <code class="preview-code"
                >${this.previewFormula || '(空)'}</code
              >
              ${!this.formulaComplete
                ? html`
                    <span class="preview-warn"
                      >条件ブロックを COND にはめ込んでください（うっすら表示は確定に使えません）</span
                    >
                  `
                : null}
            </label>
            <div class="actions">
              <button type="button" class="btn secondary" @click=${this.close}>
                キャンセル
              </button>
              <button
                type="button"
                class="btn primary"
                ?disabled=${this.busy || !this.formulaComplete}
                title=${!this.formulaComplete
                  ? '条件ブロックをはめ込んでから確定してください'
                  : ''}
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

  private bindResizeObserver(
    mount: HTMLElement,
    handle: FormulaWorkspaceHandle,
  ): void {
    this._resizeObserver?.disconnect()
    let timer: ReturnType<typeof setTimeout> | null = null
    this._resizeObserver = new ResizeObserver(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        handle.resize()
      }, 80)
    })
    this._resizeObserver.observe(mount)
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

    .error-hint {
      margin: 4px 16px 0;
      color: #6b7280;
      font-size: 12px;
    }

    .hint {
      margin: 8px 16px 0;
      color: #6b7280;
      font-size: 13px;
    }

    .guide {
      margin: 8px 16px 0;
      padding: 8px 10px;
      font-size: 12px;
      color: #374151;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      line-height: 1.45;
    }

    .mount {
      flex: 1;
      min-height: 360px;
      height: 400px;
      margin: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #fff;
      overflow: hidden;
      position: relative;
    }

    /*
     * Blockly の injectionDiv は height:100% を持つが、flex で解決された
     * .mount の高さは「不定」扱いとなり 100% が 0 に潰れる（SVG 高さ 0）。
     * .mount を position:relative にし injectionDiv を絶対配置で枠いっぱいに
     * 広げることで、高さ計算を flex から切り離して安定させる。
     */
    .mount .injectionDiv {
      position: absolute;
      inset: 0;
    }

    /*
     * 編集可能フィールド（文字列・数値）の背景枠。Blockly コアCSSには
     * fill 指定が無く、本来はレンダラ/テーマが属性で付与するが Shadow DOM
     * 内では適用されず SVG 既定色（黒）になり「黒地に黒文字」で読めなくなる。
     * 白背景・濃色文字を明示して可読性を確保する。
     */
    .mount .blocklyFieldRect {
      fill: #ffffff;
    }
    .mount text.blocklyText {
      fill: #1a1a1a;
    }

    /* shadow ブロック（見本）: 薄く点線表示・フィールド操作不可 */
    .mount .blocklyShadow > .blocklyPath {
      opacity: 0.35;
      stroke-dasharray: 4 3;
    }
    .mount .blocklyShadow .blocklyEditableText,
    .mount .blocklyShadow .blocklyDropdownText,
    .mount .blocklyShadow .blocklyTextInput {
      pointer-events: none;
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

    .preview-warn {
      font-size: 11px;
      color: #b45309;
      line-height: 1.4;
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
