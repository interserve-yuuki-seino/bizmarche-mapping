import { LitElement, css, html, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { apiConfig } from './api/config'
import {
  createMappingEditor,
  type MappingEditorHandle,
} from './rete/mapping-editor'
import type { EntitySchemaCatalogItem } from './api/catalog'
import {
  getEntitySchemaCatalog,
  resolveCatalogSchemaPath,
  resolveCatalogTargetSearchPath,
} from './api/catalog'
import { getEntitySchemaText } from './api/entity-schema'
import {
  createEmptyEntitySchemaState,
  entitySchemaStateFromDefinition,
  extractEntityFields,
  parseEntitySchemaJson,
} from './entity-schema/state'
import {
  entityFieldDisplayLabel,
  findEntityFieldByName,
  resolveEntityFieldName,
  type EntityFieldRow,
  type EntitySchemaState,
} from './entity-schema/types'
import { postConverterQuery } from './api/converter'
import { buildIndexAppQuery } from './query/build-query'
import {
  applyConnections,
  createViewFieldState,
  type ViewFieldConnection,
  type ViewFieldPatch,
  type ViewFieldState,
} from './mapping/view-field-state'
import {
  createRowExpandEntry,
  normalizeRowExpands,
  type RowExpandEntry,
} from './mapping/row-expands-state'
import './ui/entity-field-palette'

@customElement('bizmarche-converter-mapping')
export class BizmarcheConverterMapping extends LitElement {
  private _editor?: MappingEditorHandle
  private _editorInit?: Promise<void>
  /** 直近に読み込んだカタログ path（属性変更時の再読込判定） */
  private _loadedCatalogPath = ''

  /** EntitySchema カタログの fileSystemId（未指定時は config の既定値） */
  @property({ type: String, attribute: 'catalog-path' })
  catalogPath = ''

  @state() private catalogItems: EntitySchemaCatalogItem[] = []
  @state() private selectedCatalogId = ''
  @state() private schemaPath = ''
  @state() private entityJsonText = ''
  /** EntitySchema JSON パネルの展開状態 */
  @state() private entityJsonExpanded = false
  @state() private entityFields: EntityFieldRow[] = []
  @state() private entitySchemaState: EntitySchemaState =
    createEmptyEntitySchemaState()

  @state() private loadingCatalog = false
  @state() private loadingSchema = false
  @state() private catalogError: string | null = null
  @state() private schemaError: string | null = null

  @state() private targetSearchPath = ''
  @state() private viewFields: ViewFieldState[] = []
  @state() private rowExpands: RowExpandEntry[] = []
  @state() private connections: ViewFieldConnection[] = []
  @state() private canvasEntityFieldNames: string[] = []
  @state() private queryJson = '{}'
  @state() private loadingConverter = false
  @state() private converterError: string | null = null
  @state() private converterResultJson = ''

  /** パレット表示用（キャンバスに出ている Entity は除外） */
  private get paletteEntityFields(): EntityFieldRow[] {
    const onCanvas = new Set(this.canvasEntityFieldNames)
    return this.entityFields.filter((f) => !onCanvas.has(f.fieldName))
  }

  /** rowExpands 入力の datalist 候補（Entity フィールド） */
  private get rowExpandLookupFields(): EntityFieldRow[] {
    const byName = new Map<string, EntityFieldRow>()
    for (const f of this.entityFields) {
      const name = f.fieldName.trim()
      if (name) byName.set(name, f)
    }
    for (const name of this.canvasEntityFieldNames) {
      const trimmed = name.trim()
      if (trimmed && !byName.has(trimmed)) {
        byName.set(trimmed, { fieldName: trimmed })
      }
    }
    return [...byName.values()].sort((a, b) =>
      entityFieldDisplayLabel(a).localeCompare(
        entityFieldDisplayLabel(b),
        'ja',
      ),
    )
  }

  /** rowExpands 入力欄の表示値（displayName があれば優先） */
  private rowExpandDisplayValue(fieldName: string): string {
    const field = findEntityFieldByName(fieldName, this.rowExpandLookupFields)
    return entityFieldDisplayLabel(field ?? { fieldName })
  }

  /** displayName 表示時に fieldName をサブ表示するか */
  private rowExpandShowsFieldNameSub(fieldName: string): boolean {
    const field = findEntityFieldByName(fieldName, this.rowExpandLookupFields)
    return Boolean(field?.displayName?.trim())
  }

  /** converter 実行に最低限必要な Query が揃っているか */
  private get canRunConverter(): boolean {
    const q = this.buildCurrentQuery()
    const hasTarget = Boolean(q.target?.searchPath?.trim())
    const es = q.entitySchema
    const hasEntity =
      Boolean(es?.schemaPath?.trim()) ||
      Boolean(es?.fields && es.fields.length > 0)
    return hasTarget && hasEntity
  }

  private buildCurrentQuery() {
    return buildIndexAppQuery({
      targetSearchPath: this.targetSearchPath,
      entitySchemaState: this.entitySchemaState,
      viewFields: this.viewFields,
      rowExpands: normalizeRowExpands(this.rowExpands),
    })
  }

  render() {
    return html`
      <div class="layout">
        <header class="topbar">
          <span class="title">Converter Mapping</span>
          <label>
            EntitySchema（catalog）
            <select
              .value=${this.selectedCatalogId}
              ?disabled=${this.loadingCatalog}
              @change=${this.onCatalogChange}
            >
              ${this.catalogItems.length === 0
                ? html`<option value="">— 選択 —</option>`
                : null}
              ${this.catalogItems.map(
                (item) => html`
                  <option value=${item.id}>${item.name ?? item.id}</option>
                `,
              )}
            </select>
          </label>
          <label class="grow">
            searchPath（target）
            <input
              type="text"
              .value=${this.targetSearchPath}
              placeholder="//garage-petabo/test/data/aden"
              @input=${(e: Event) => {
                this.targetSearchPath = (e.target as HTMLInputElement).value
                this.rebuildQueryJson()
              }}
            />
          </label>
          <label class="grow">
            schemaPath
            <input
              type="text"
              .value=${this.schemaPath}
              placeholder="settings/test/entitySchema/..."
              @input=${(e: Event) => {
                this.schemaPath = (e.target as HTMLInputElement).value
                this.entitySchemaState = {
                  ...this.entitySchemaState,
                  schemaPath: this.schemaPath,
                  mode: this.schemaPath.trim() ? 'path' : 'inline',
                }
                this.rebuildQueryJson()
              }}
            />
          </label>
          <button
            type="button"
            ?disabled=${this.loadingCatalog}
            @click=${() => void this.loadCatalog()}
          >
            ${this.loadingCatalog ? '読込中...' : 'カタログ再読込'}
          </button>
          <button
            type="button"
            ?disabled=${this.loadingSchema || !this.schemaPath.trim()}
            @click=${() => void this.loadSchema()}
          >
            ${this.loadingSchema ? '取得中...' : 'schema取得'}
          </button>
          <button type="button" @click=${this.addViewField}>+ ViewField</button>
        </header>

        ${this.catalogError
          ? html`<div class="banner error">${this.catalogError}</div>`
          : null}
        ${this.schemaError
          ? html`<div class="banner error">${this.schemaError}</div>`
          : null}

        <div class="main">
          <aside class="sidebar">
            <details
              class="panel entity-json-panel"
              .open=${this.entityJsonExpanded}
              @toggle=${this.onEntityJsonPanelToggle}
            >
              <summary class="panel-title entity-json-summary">
                EntitySchema JSON
              </summary>
              <div class="entity-json-body">
                <textarea
                  class="json-area"
                  .value=${this.entityJsonText}
                  @input=${(e: Event) => {
                    this.entityJsonText = (e.target as HTMLTextAreaElement).value
                  }}
                ></textarea>
                <button type="button" @click=${this.applyEntityJson}>
                  JSONを反映
                </button>
              </div>
            </details>
            <section class="panel palette-panel">
              <div class="panel-title">Entity フィールド</div>
              <entity-field-palette
                .fields=${this.paletteEntityFields}
                @pick-field=${this.onPickEntityField}
              ></entity-field-palette>
            </section>
          </aside>

          <div class="canvas-wrap">
            <div id="rete"></div>
          </div>

          <aside class="sidebar right">
            <section class="panel row-expands-panel">
              <div class="panel-title">行展開（rowExpands）</div>
              <p class="row-expands-hint">
                配列項目を行展開（CrossJoin）。集計と併用不可。
              </p>
              <datalist id="row-expand-suggestions">
                ${this.rowExpandLookupFields.map(
                  (f) =>
                    html`<option value=${entityFieldDisplayLabel(f)}></option>`,
                )}
              </datalist>
              <div class="row-expands-list">
                ${this.rowExpands.length === 0
                  ? html`<div class="row-expands-empty">未設定</div>`
                  : this.rowExpands.map(
                      (entry) => html`
                        <div class="row-expand-row">
                          <div class="row-expand-main">
                            <input
                              type="text"
                              class="row-expand-input"
                              .value=${this.rowExpandDisplayValue(
                                entry.fieldName,
                              )}
                              placeholder="配列項目名（例: quantities）"
                              list="row-expand-suggestions"
                              @input=${(e: Event) =>
                                this.onRowExpandInput(
                                  entry.id,
                                  (e.target as HTMLInputElement).value,
                                )}
                            />
                            ${this.rowExpandShowsFieldNameSub(entry.fieldName)
                              ? html`<span class="row-expand-sub"
                                  >${entry.fieldName}</span
                                >`
                              : null}
                          </div>
                          <button
                            type="button"
                            class="row-expand-remove"
                            title="削除"
                            @click=${() => this.removeRowExpand(entry.id)}
                          >
                            ×
                          </button>
                        </div>
                      `,
                    )}
              </div>
              <button type="button" @click=${this.addRowExpand}>
                + 行展開項目
              </button>
            </section>
            <section class="panel output-panel">
              <div class="panel-title">出力（IndexAppQuery）</div>
              <pre class="json-preview query-preview">${this.queryJson}</pre>
              <button
                type="button"
                class="primary"
                ?disabled=${this.loadingConverter || !this.canRunConverter}
                @click=${() => void this.runConverter()}
              >
                ${this.loadingConverter ? '変換中...' : 'converter 実行'}
              </button>
              ${this.converterError
                ? html`<div class="inline-error">${this.converterError}</div>`
                : null}
              ${this.converterResultJson
                ? html`
                    <div class="panel-title sub">変換結果</div>
                    <pre class="json-preview">${this.converterResultJson}</pre>
                  `
                : null}
            </section>
          </aside>
        </div>
      </div>
    `
  }

  protected override firstUpdated() {
    void this.initEditor()
    void this.loadCatalog()
  }

  override updated(changed: PropertyValues) {
    if (!changed.has('catalogPath')) return
    const path = this.resolveCatalogPath()
    if (path === this._loadedCatalogPath) return
    this.selectedCatalogId = ''
    void this.loadCatalog()
  }

  private resolveCatalogPath(): string {
    return this.catalogPath.trim() || apiConfig.entitySchemaCatalogPath
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._editor?.destroy()
    this._editor = undefined
    this._editorInit = undefined
  }

  private async initEditor() {
    if (this._editorInit) return this._editorInit
    this._editorInit = (async () => {
      const container = this.renderRoot.querySelector<HTMLElement>('#rete')
      if (!container) return

      this._editor = await createMappingEditor(container, {
        onConnectionsChange: (next) => this.handleConnectionsChange(next),
        onViewFieldPatch: (patch) => this.handleViewFieldPatch(patch),
        onCanvasEntityFieldsChange: (names) => {
          this.canvasEntityFieldNames = names
        },
      })

      for (const vf of this.viewFields) {
        await this._editor.addViewFieldNode(vf)
      }
      this._editor.syncViewFields(this.viewFields)
      this.rebuildQueryJson()
    })()
    return this._editorInit
  }

  private async ensureEditor(): Promise<MappingEditorHandle | undefined> {
    await this.initEditor()
    return this._editor
  }

  private async loadCatalog() {
    this.loadingCatalog = true
    this.catalogError = null
    try {
      const catalogPath = this.resolveCatalogPath()
      const items = await getEntitySchemaCatalog(catalogPath)
      this._loadedCatalogPath = catalogPath
      this.catalogItems = items
      if (items.length > 0) {
        const hasValidSelection = items.some(
          (x) => x.id === this.selectedCatalogId,
        )
        const pick = hasValidSelection
          ? items.find((x) => x.id === this.selectedCatalogId)!
          : items[0]!
        this.selectedCatalogId = pick.id
        if (!hasValidSelection) {
          await this.applyCatalogItem(pick)
        }
      } else {
        this.selectedCatalogId = ''
      }
    } catch {
      this.catalogError =
        'カタログの取得に失敗しました。接続先とCORS設定を確認してください。'
      this.catalogItems = []
    } finally {
      this.loadingCatalog = false
    }
  }

  private onCatalogChange(e: Event) {
    const id = (e.target as HTMLSelectElement).value
    if (!id) return
    const picked = this.catalogItems.find((x) => x.id === id)
    if (!picked) return
    void this.applyCatalogItem(picked)
  }

  /** カタログ選択時に schemaPath / target を反映 */
  private async applyCatalogItem(item: EntitySchemaCatalogItem) {
    this.selectedCatalogId = item.id
    this.schemaPath = resolveCatalogSchemaPath(item)

    const target = resolveCatalogTargetSearchPath(item)
    if (target) {
      this.targetSearchPath = target
      this.rebuildQueryJson()
    }

    await this.loadSchema()
  }

  private async loadSchema() {
    const path = this.schemaPath.trim()
    if (!path) return
    this.loadingSchema = true
    this.schemaError = null
    try {
      const text = await getEntitySchemaText(path)
      this.entityJsonText = text
      const parsed = parseEntitySchemaJson(text)
      if (parsed) {
        this.applyEntityState(
          entitySchemaStateFromDefinition(parsed, path),
        )
      }
    } catch {
      this.schemaError =
        'EntitySchema の取得に失敗しました。schemaPath / bucketCode / CORS を確認してください。'
      this.entityFields = []
    } finally {
      this.loadingSchema = false
    }
  }

  private onEntityJsonPanelToggle(e: Event) {
    this.entityJsonExpanded = (e.target as HTMLDetailsElement).open
  }

  private applyEntityJson() {
    const parsed = parseEntitySchemaJson(this.entityJsonText)
    if (!parsed) {
      this.schemaError = 'JSONの形式が正しくありません'
      return
    }
    this.schemaError = null
    this.applyEntityState(
      entitySchemaStateFromDefinition(parsed, this.schemaPath),
    )
  }

  private applyEntityState(state: EntitySchemaState) {
    this.entitySchemaState = state
    this.schemaPath = state.schemaPath
    this.entityFields = extractEntityFields(state.definition)
    if (this.entityFields.length === 0 && this.entityJsonText.trim()) {
      const fromText = parseEntitySchemaJson(this.entityJsonText)
      if (fromText) {
        this.entityFields = extractEntityFields(fromText)
        this.entitySchemaState = entitySchemaStateFromDefinition(
          fromText,
          state.schemaPath,
        )
      }
    }
    this.rebuildQueryJson()
  }

  /** 未使用の ViewField を探すか、同名用に新規作成 */
  private findOrCreateViewFieldForEntity(fieldName: string): ViewFieldState {
    const linked = new Map(
      this.connections.map((c) => [c.toViewFieldId, c.fromEntityFieldName]),
    )

    const byConnection = this.viewFields.find(
      (vf) => linked.get(vf.id) === fieldName,
    )
    if (byConnection) return byConnection

    const byName = this.viewFields.find((vf) => vf.fieldName === fieldName)
    if (byName) return byName

    const idle = this.viewFields.find(
      (vf) =>
        !linked.has(vf.id) &&
        !vf.fieldName.trim() &&
        !vf.formula.trim(),
    )
    if (idle) {
      return {
        ...idle,
        fieldName,
        formula: fieldName,
        overrideFieldName: false,
      }
    }

    return {
      ...createViewFieldState(),
      fieldName,
      formula: fieldName,
      overrideFieldName: false,
    }
  }

  /** Entity フィールドを ViewField に自動マッピング（ノード追加＋接続） */
  private async mapSingleEntityField(fieldName: string) {
    const ed = await this.ensureEditor()
    if (!ed) return

    const vf = this.findOrCreateViewFieldForEntity(fieldName)
    const exists = this.viewFields.some((v) => v.id === vf.id)
    this.viewFields = exists
      ? this.viewFields.map((v) => (v.id === vf.id ? vf : v))
      : [...this.viewFields, vf]

    await ed.addViewFieldNode(vf)
    await ed.refreshViewFieldNode(vf.id)
    const entityField = this.entityFields.find((f) => f.fieldName === fieldName)
    await ed.addEntityFieldNode(fieldName, entityField?.displayName)
    await ed.connectEntityFieldToView(fieldName, vf.id)
  }

  private async onPickEntityField(e: CustomEvent<string>) {
    await this.mapSingleEntityField(e.detail)
  }

  private async addViewField() {
    const vf = createViewFieldState()
    this.viewFields = [...this.viewFields, vf]
    const ed = await this.ensureEditor()
    if (!ed) return
    await ed.addViewFieldNode(vf)
    await ed.refreshViewFieldNode(vf.id)
    this.rebuildQueryJson()
  }

  private handleViewFieldPatch(patch: ViewFieldPatch) {
    this.viewFields = this.viewFields.map((n) =>
      n.id === patch.id ? { ...n, ...patch } : n,
    )
    this.rebuildQueryJson()
    // 入力中は control を差し替えない（フォーカス維持）
  }

  private handleConnectionsChange(next: ViewFieldConnection[]) {
    const prev = this.connections
    this.connections = next
    this.viewFields = applyConnections(this.viewFields, next, prev)
    this.rebuildQueryJson()
    this._editor?.syncViewFields(this.viewFields)
  }

  private rebuildQueryJson() {
    this.queryJson = JSON.stringify(this.buildCurrentQuery(), null, 2)
  }

  private addRowExpand() {
    this.rowExpands = [...this.rowExpands, createRowExpandEntry()]
    this.rebuildQueryJson()
  }

  private removeRowExpand(id: string) {
    this.rowExpands = this.rowExpands.filter((e) => e.id !== id)
    this.rebuildQueryJson()
  }

  private onRowExpandInput(id: string, rawInput: string) {
    const fieldName = resolveEntityFieldName(
      rawInput,
      this.rowExpandLookupFields,
    )
    this.rowExpands = this.rowExpands.map((e) =>
      e.id === id ? { ...e, fieldName } : e,
    )
    this.rebuildQueryJson()
  }

  private async runConverter() {
    const query = this.buildCurrentQuery()
    if (!query.target?.searchPath?.trim()) {
      this.converterError = 'target.searchPath を設定してください'
      return
    }
    const es = query.entitySchema
    if (
      !es?.schemaPath?.trim() &&
      !(es?.fields && es.fields.length > 0)
    ) {
      this.converterError = 'entitySchema（schemaPath または定義）を設定してください'
      return
    }

    this.loadingConverter = true
    this.converterError = null
    this.converterResultJson = ''

    try {
      const res = await postConverterQuery(query)
      this.converterResultJson = JSON.stringify(res, null, 2)
      if (res.resultCode !== 0) {
        this.converterError =
          res.resultMessage ?? `converter エラー (code: ${res.resultCode})`
      }
    } catch (e) {
      this.converterError =
        e instanceof Error
          ? e.message
          : 'converter の呼び出しに失敗しました。CORS / 接続先を確認してください。'
      this.converterResultJson = ''
    } finally {
      this.loadingConverter = false
    }
  }

  static styles = css`
    :host {
      --bg: #fff;
      --border: #e5e4e7;
      --panel-bg: #f8f8f9;
      --hover: rgba(0, 0, 0, 0.06);

      display: block;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      min-height: 100svh;
      font-family: system-ui, sans-serif;
      font-size: 14px;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --bg: #16171d;
        --border: #2e303a;
        --panel-bg: #1e1f26;
        --hover: rgba(255, 255, 255, 0.08);
      }
    }

    .layout {
      display: flex;
      flex-direction: column;
      height: 100svh;
      min-height: 0;
    }

    .topbar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 8px 12px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      background: var(--bg);
    }

    .title {
      font-weight: 600;
      margin-right: 8px;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    label.grow {
      flex: 1;
      min-width: 200px;
    }

    input,
    select,
    button,
    textarea {
      font: inherit;
    }

    input[type='text'],
    select {
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg);
      color: inherit;
    }

    button {
      padding: 6px 12px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--panel-bg);
      color: inherit;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .banner {
      padding: 8px 12px;
      font-size: 13px;
    }

    .banner.error {
      background: #fee;
      color: #900;
    }

    @media (prefers-color-scheme: dark) {
      .banner.error {
        background: #3a1f1f;
        color: #f88;
      }
    }

    .main {
      display: grid;
      grid-template-columns: 280px 1fr 280px;
      flex: 1;
      min-height: 0;
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      border-right: 1px solid var(--border);
      background: var(--panel-bg);
      min-height: 0;
      overflow: hidden;
    }

    .sidebar.right {
      border-right: none;
      border-left: 1px solid var(--border);
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
    }

    .entity-json-panel {
      flex-shrink: 0;
    }

    .entity-json-panel[open] {
      flex: 0 1 45%;
      min-height: 0;
      max-height: 55%;
      overflow: hidden;
    }

    .entity-json-summary {
      cursor: pointer;
      user-select: none;
      list-style: none;
    }

    .entity-json-summary::-webkit-details-marker {
      display: none;
    }

    .entity-json-summary::before {
      content: '▸ ';
      opacity: 0.75;
    }

    .entity-json-panel[open] > .entity-json-summary::before {
      content: '▾ ';
    }

    .entity-json-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
      flex: 1;
    }

    .entity-json-panel[open] .json-area {
      flex: 1;
      min-height: 120px;
      max-height: none;
      resize: none;
    }

    .palette-panel {
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      min-height: 0;
      overflow: hidden;
    }

    entity-field-palette {
      flex: 1;
      min-height: 0;
    }

    .panel-title {
      font-size: 12px;
      font-weight: 600;
      opacity: 0.85;
    }

    .json-area {
      width: 100%;
      min-height: 0;
      max-height: 200px;
      box-sizing: border-box;
      padding: 8px;
      font-family: ui-monospace, monospace;
      font-size: 11px;
      border: 1px solid var(--border);
      border-radius: 4px;
      resize: vertical;
      background: var(--bg);
      color: inherit;
    }

    .output-panel {
      flex: 1;
      min-height: 0;
    }

    .row-expands-panel {
      flex-shrink: 0;
    }

    .row-expands-hint {
      margin: 0;
      font-size: 11px;
      opacity: 0.75;
      line-height: 1.4;
    }

    .row-expands-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .row-expands-empty {
      font-size: 12px;
      opacity: 0.6;
    }

    .row-expand-row {
      display: flex;
      gap: 6px;
      align-items: flex-start;
    }

    .row-expand-main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .row-expand-sub {
      font-size: 10px;
      opacity: 0.65;
      word-break: break-all;
    }

    .row-expand-input {
      flex: 1;
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg);
      color: inherit;
      font-size: 12px;
    }

    .row-expand-remove {
      flex-shrink: 0;
      width: 28px;
      padding: 4px 0;
      line-height: 1;
    }

    .panel-title.sub {
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
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg);
    }

    .json-preview.query-preview {
      flex: 1;
      min-height: 120px;
      max-height: 40vh;
    }

    button.primary {
      background: #2563eb;
      color: #fff;
      border-color: #1d4ed8;
    }

    button.primary:hover:not(:disabled) {
      background: #1d4ed8;
    }

    button.primary:disabled {
      opacity: 0.55;
    }

    .inline-error {
      font-size: 12px;
      color: #b91c1c;
    }

    @media (prefers-color-scheme: dark) {
      button.primary {
        background: #3b82f6;
        border-color: #2563eb;
      }

      .inline-error {
        color: #f87171;
      }
    }

    .canvas-wrap {
      min-height: 0;
      overflow: hidden;
      background: var(--bg);
    }

    #rete {
      width: 100%;
      height: 100%;
      min-height: 400px;
      /* rete-node の入力コントロール用（shadow DOM に継承） */
      --node-width: 200px;
    }

    /* ViewField: 2 行の入力が収まるよう高さは内容に合わせる */
    #rete rete-node:has(bm-view-field-control) {
      --node-width: 248px;
      height: auto !important;
      min-height: 0;
    }

    #rete rete-node:has(bm-view-field-control) .control,
    #rete rete-node:has(bm-view-field-control) .controls {
      overflow: visible;
    }

    #rete bm-view-field-control {
      display: block;
      width: 100%;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'bizmarche-converter-mapping': BizmarcheConverterMapping
  }
}
