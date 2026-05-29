import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('bm-converter-result-panel')
export class ConverterResultPanel extends LitElement {
  @property({ type: String })
  preview = ''

  @property({ type: Boolean })
  hasResult = false

  @property({ attribute: false })
  onDownload?: () => void

  render() {
    if (!this.hasResult && !this.preview) return null

    return html`
      <div class="result-block">
        <div class="panel-title sub">変換結果（プレビュー）</div>
        <pre class="json-preview result-preview">${this.preview}</pre>
        <button
          type="button"
          class="download-btn"
          ?disabled=${!this.hasResult}
          @click=${() => this.onDownload?.()}
        >
          JSONをダウンロード
        </button>
      </div>
    `
  }

  static styles = css`
    .result-block {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 0;
    }

    .panel-title.sub {
      font-size: 12px;
      font-weight: 600;
      opacity: 0.85;
      margin-top: 4px;
    }

    .json-preview {
      margin: 0;
      padding: 8px;
      font-size: 11px;
      font-family: ui-monospace, monospace;
      white-space: pre-wrap;
      word-break: break-all;
      overflow: auto;
      border: 1px solid var(--border, #e5e4e7);
      border-radius: 4px;
      background: var(--bg, #fff);
      color: inherit;
    }

    .result-preview {
      max-height: 30vh;
      min-height: 0;
    }

    .download-btn {
      align-self: flex-start;
      padding: 6px 12px;
      font: inherit;
      font-size: 12px;
      border: 1px solid var(--border, #e5e4e7);
      border-radius: 4px;
      background: var(--panel-bg, #f8f8f9);
      color: inherit;
      cursor: pointer;
    }

    .download-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .download-btn:hover:not(:disabled) {
      background: var(--hover, rgba(0, 0, 0, 0.06));
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'bm-converter-result-panel': ConverterResultPanel
  }
}
