import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { EntityFieldRow } from '../entity-schema/types'

@customElement('entity-field-palette')
export class EntityFieldPalette extends LitElement {
  @property({ attribute: false })
  fields: EntityFieldRow[] = []

  @state()
  private query = ''

  render() {
    const q = this.query.trim().toLowerCase()
    const filtered = q
      ? this.fields.filter((f) => {
          const a = f.fieldName.toLowerCase()
          const b = (f.displayName ?? '').toLowerCase()
          return a.includes(q) || b.includes(q)
        })
      : this.fields

    return html`
      <div class="palette">
        <input
          class="search"
          type="search"
          placeholder="フィールド検索..."
          .value=${this.query}
          @input=${(e: Event) => {
            this.query = (e.target as HTMLInputElement).value
          }}
        />
        <ul class="list">
          ${filtered.length === 0
            ? html`<li class="empty">フィールドがありません</li>`
            : filtered.map(
                (f) => html`
                  <li>
                    <button
                      type="button"
                      class="item"
                      @click=${() =>
                        this.dispatchEvent(
                          new CustomEvent('pick-field', {
                            detail: f.fieldName,
                            bubbles: true,
                            composed: true,
                          }),
                        )}
                    >
                      <span class="name">${f.fieldName}</span>
                      ${f.displayName
                        ? html`<span class="sub">${f.displayName}</span>`
                        : null}
                      ${f.length != null
                        ? html`<span class="meta">len:${f.length}</span>`
                        : null}
                    </button>
                  </li>
                `,
              )}
        </ul>
      </div>
    `
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .palette {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .search {
      width: 100%;
      box-sizing: border-box;
      padding: 6px 8px;
      font-size: 13px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--panel-bg);
      color: inherit;
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow: auto;
      flex: 1;
      min-height: 0;
    }
    .item {
      width: 100%;
      text-align: left;
      padding: 6px 8px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: baseline;
    }
    .item:hover {
      background: var(--hover, rgba(0, 0, 0, 0.06));
    }
    .name {
      font-weight: 600;
      font-size: 12px;
    }
    .sub {
      font-size: 11px;
      opacity: 0.8;
    }
    .meta {
      font-size: 10px;
      opacity: 0.6;
    }
    .empty {
      padding: 8px;
      font-size: 12px;
      opacity: 0.7;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'entity-field-palette': EntityFieldPalette
  }
}
