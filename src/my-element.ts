import { LitElement, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { createBasicEditor, type BasicEditorHandle } from './rete/basic-editor'

@customElement('my-element')
export class MyElement extends LitElement {
  private _rete?: BasicEditorHandle
  private _reteInitPromise?: Promise<void>

  render() {
    return html`<div id="rete" part="rete"></div>`
  }

  protected override firstUpdated() {
    const container = this.renderRoot.querySelector<HTMLElement>('#rete')
    if (!container) return

    // Lit の再レンダリング等で多重初期化しないためのガード
    if (this._reteInitPromise) return

    this._reteInitPromise = (async () => {
      this._rete = await createBasicEditor(container)
    })()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._rete?.destroy()
    this._rete = undefined
    this._reteInitPromise = undefined
  }

  static styles = css`
    :host {
      --bg: #fff;
      --border: #e5e4e7;

      display: block;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      min-height: 100svh;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --bg: #16171d;
        --border: #2e303a;
      }
    }

    #rete {
      width: 100%;
      height: 100%;
      min-height: inherit;
      background: var(--bg);
      overflow: hidden;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'my-element': MyElement
  }
}
