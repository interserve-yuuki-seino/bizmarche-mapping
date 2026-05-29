import { html } from 'lit'
import { AreaPlugin } from 'rete-area-plugin'
import { ClassicPreset, NodeEditor } from 'rete'
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin'
import { LitPlugin, Presets, type LitArea2D } from '@retejs/lit-plugin'
import type {
  ViewFieldConnection,
  ViewFieldPatch,
  ViewFieldState,
} from '../mapping/view-field-state'
import { EntityFieldNode, ViewFieldNode, type Schemes } from './nodes'
import {
  asViewFieldControl,
  isReteViewFieldControl,
  type ReteViewFieldControl,
} from './controls/view-field-control'

import './controls/view-field-control'

/** Rete ノード内テキスト入力（明るい背景＋濃い文字） */
const RETE_TEXT_INPUT_STYLE =
  'box-sizing:border-box;width:100%;max-width:100%;padding:4px 6px;font-size:12px;border:1px solid #9ca3af;border-radius:4px;background:#fff;color:#16171d;'

type AreaExtra = LitArea2D<Schemes>

export type MappingEditorCallbacks = {
  onConnectionsChange?: (connections: ViewFieldConnection[]) => void
  onViewFieldPatch?: (patch: ViewFieldPatch) => void
  /** キャンバス上の EntityField ノード名一覧 */
  onCanvasEntityFieldsChange?: (fieldNames: string[]) => void
}

export type MappingEditorHandle = {
  destroy: () => void
  addEntityFieldNode: (
    fieldName: string,
    displayName?: string,
  ) => Promise<void>
  addViewFieldNode: (state: ViewFieldState) => Promise<void>
  removeViewFieldNode: (viewFieldId: string) => Promise<void>
  /** EntityField(value) → ViewField(in) を接続（既存の接続は置き換え） */
  connectEntityFieldToView: (
    entityFieldName: string,
    viewFieldId: string,
  ) => Promise<void>
  syncViewFields: (viewFields: ViewFieldState[]) => void
  /** 初回描画で control が載らない場合の再描画 */
  refreshViewFieldNode: (viewFieldId: string) => Promise<void>
  refreshAllViewFieldNodes: () => Promise<void>
}

export async function createMappingEditor(
  container: HTMLElement,
  callbacks: MappingEditorCallbacks = {},
): Promise<MappingEditorHandle> {
  const editor = new NodeEditor<Schemes>()
  const area = new AreaPlugin<Schemes, AreaExtra>(container)
  const render = new LitPlugin<Schemes, AreaExtra>()
  const connection = new ConnectionPlugin<Schemes, AreaExtra>()

  render.addPreset(
    Presets.classic.setup({
      customize: {
        control(context) {
          // payload は描画のたびに参照する（初回だけ未設定だと () => null が固定される）
          return () => {
            const payload = context.payload
            if (isReteViewFieldControl(payload)) {
              const p = payload
              return html`<bm-view-field-control
                .viewFieldId=${p.viewFieldId}
                .fieldName=${p.fieldName}
                .formula=${p.formula}
                .overrideFieldName=${p.overrideFieldName}
                .onPatch=${p.onPatch}
                .syncRevision=${p.syncRevision ?? 0}
              ></bm-view-field-control>`
            }
            if (payload instanceof ClassicPreset.InputControl) {
              const ctrl = payload
              return html`
                <input
                  class="rete-input"
                  type=${ctrl.type}
                  style=${RETE_TEXT_INPUT_STYLE}
                  .value=${String(ctrl.value ?? '')}
                  ?readonly=${ctrl.readonly}
                  @input=${(e: Event) => {
                    ctrl.setValue((e.target as HTMLInputElement).value)
                  }}
                  @pointerdown=${(e: Event) => e.stopPropagation()}
                />
              `
            }
            return null
          }
        },
      },
    }),
  )
  connection.addPreset(ConnectionPresets.classic.setup())

  editor.use(area)
  area.use(render)
  area.use(connection)

  const entityFieldNodeByName = new Map<string, EntityFieldNode>()
  const viewNodeById = new Map<string, ClassicPreset.Node>()
  const entityFieldPosByName = new Map<string, { x: number; y: number }>()
  const viewFieldPosById = new Map<string, { x: number; y: number }>()

  let rebuilding = false
  let lastEmittedConnectionsJson = ''
  let lastEmittedCanvasFieldsJson = ''
  let connectionSyncTimer: ReturnType<typeof setTimeout> | null = null

  const emitCanvasEntityFields = () => {
    const names = [...entityFieldNodeByName.keys()].sort()
    const json = JSON.stringify(names)
    if (json === lastEmittedCanvasFieldsJson) return
    lastEmittedCanvasFieldsJson = json
    callbacks.onCanvasEntityFieldsChange?.(names)
  }

  const resolveNodeId = (ref: unknown): string => {
    if (ref == null) return ''
    if (typeof ref === 'string') return ref
    if (typeof ref === 'object' && ref !== null && 'id' in ref) {
      return String((ref as { id: unknown }).id)
    }
    return String(ref)
  }

  const entityFieldNameFromNode = (node: ClassicPreset.Node): string | null => {
    const reteId = resolveNodeId(node.id)
    const fromMap = [...entityFieldNodeByName.entries()].find(
      ([, n]) => resolveNodeId(n.id) === reteId,
    )?.[0]
    if (fromMap) return fromMap

    const data = (node as EntityFieldNode).data
    if (data?.fieldName) return data.fieldName

    const match = /^EntityField:\s*(.+)$/i.exec(String(node.label ?? ''))
    return match?.[1]?.trim() || null
  }

  const viewFieldIdFromNode = (node: ClassicPreset.Node): string | null => {
    const reteId = resolveNodeId(node.id)
    const fromMap = [...viewNodeById.entries()].find(
      ([, n]) => resolveNodeId(n.id) === reteId,
    )?.[0]
    if (fromMap) return fromMap

    const control = node.controls?.viewField
    if (isReteViewFieldControl(control)) return control.viewFieldId

    const data = (node as ViewFieldNode).data
    return data?.viewFieldId ?? null
  }

  const resolveConnection = (
    con: ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node>,
  ): ViewFieldConnection | null => {
    if (String(con.sourceOutput) !== 'value' || String(con.targetInput) !== 'in') {
      return null
    }

    const sourceId = resolveNodeId(con.source)
    const targetId = resolveNodeId(con.target)
    const nodes = editor.getNodes()
    const sourceNode = nodes.find((n) => resolveNodeId(n.id) === sourceId)
    const targetNode = nodes.find((n) => resolveNodeId(n.id) === targetId)
    if (!sourceNode || !targetNode) return null

    const fromEntityFieldName = entityFieldNameFromNode(sourceNode)
    const toViewFieldId = viewFieldIdFromNode(targetNode)
    if (!fromEntityFieldName || !toViewFieldId) return null

    return { fromEntityFieldName, toViewFieldId }
  }

  const collectConnections = (): ViewFieldConnection[] => {
    const out: ViewFieldConnection[] = []
    const seen = new Set<string>()

    for (const con of editor.getConnections()) {
      const resolved = resolveConnection(con)
      if (!resolved) continue
      const key = `${resolved.toViewFieldId}:${resolved.fromEntityFieldName}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(resolved)
    }
    return out
  }

  /** Rete が control を再描画しないため、値変更時は control を差し替える */
  const replaceViewFieldControl = (
    node: ClassicPreset.Node,
    vf: ViewFieldState,
  ) => {
    const existing = node.controls?.viewField as ReteViewFieldControl | undefined
    const onPatch =
      existing?.onPatch ??
      ((patch: ViewFieldPatch) => callbacks.onViewFieldPatch?.(patch))

    node.removeControl('viewField')
    node.addControl(
      'viewField',
      asViewFieldControl({
        viewFieldId: vf.id,
        fieldName: vf.fieldName,
        formula: vf.formula,
        overrideFieldName: vf.overrideFieldName,
        syncRevision: (existing?.syncRevision ?? 0) + 1,
        onPatch,
      }) as never,
    )
    void area.update('node', String(node.id))
  }

  /** 接続結果を ViewField コントロールへ即時反映 */
  const applyConnectionToControls = (connections: ViewFieldConnection[]) => {
    const byTo = new Map(
      connections.map((c) => [c.toViewFieldId, c.fromEntityFieldName]),
    )

    for (const [viewFieldId, node] of viewNodeById) {
      const existing = node.controls?.viewField
      const ctrl = isReteViewFieldControl(existing) ? existing : undefined
      const from = byTo.get(viewFieldId) ?? ''

      let fieldName = ctrl?.fieldName ?? ''
      let formula = ctrl?.formula ?? ''
      let overrideFieldName = !!ctrl?.overrideFieldName

      if (from) {
        fieldName = from
        formula = from
        overrideFieldName = false
      } else if (!overrideFieldName) {
        fieldName = ''
        formula = ''
      } else {
        formula = ''
      }

      replaceViewFieldControl(node, {
        id: viewFieldId,
        fieldName,
        formula,
        overrideFieldName,
      })
    }
  }

  const emitConnections = (force = false) => {
    if (rebuilding) return
    const out = collectConnections()
    const json = JSON.stringify(out)
    if (!force && json === lastEmittedConnectionsJson) return
    lastEmittedConnectionsJson = json
    applyConnectionToControls(out)
    callbacks.onConnectionsChange?.(out)
  }

  const enforceSingleConnectionPerViewInput = async () => {
    const byTarget = new Map<
      string,
      ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node>[]
    >()
    for (const con of editor.getConnections()) {
      if (String(con.targetInput) !== 'in') continue
      const k = resolveNodeId(con.target)
      const arr = byTarget.get(k) ?? []
      arr.push(con)
      byTarget.set(k, arr)
    }
    for (const [, cons] of byTarget) {
      if (cons.length <= 1) continue
      const keep = cons[cons.length - 1]!
      for (const c of cons) {
        if (c === keep) continue
        await editor.removeConnection(c.id)
      }
    }
  }

  const scheduleConnectionSync = () => {
    if (connectionSyncTimer) clearTimeout(connectionSyncTimer)
    connectionSyncTimer = setTimeout(() => {
      connectionSyncTimer = null
      void (async () => {
        await enforceSingleConnectionPerViewInput()
        emitConnections(true)
      })()
    }, 0)
  }

  const connectionPipe = (context: unknown) => {
    const ctx = context as { type?: string; data?: unknown }
    if (
      ctx.type === 'connectioncreate' ||
      ctx.type === 'connectioncreated' ||
      ctx.type === 'connectionremove' ||
      ctx.type === 'connectionremoved'
    ) {
      scheduleConnectionSync()
    }
    if (ctx.type === 'noderemoved') {
      const node = ctx.data as ClassicPreset.Node | undefined
      const name = node ? entityFieldNameFromNode(node) : null
      if (name) {
        entityFieldNodeByName.delete(name)
        entityFieldPosByName.delete(name)
        emitCanvasEntityFields()
      }
    }
    return context
  }

  editor.addPipe(connectionPipe as never)
  area.addPipe(connectionPipe as never)

  const nextEntityPlacement = () => {
    const i = entityFieldPosByName.size
    return { x: 480, y: 80 + (i % 10) * 72 }
  }

  const nextViewPlacement = () => {
    const i = viewFieldPosById.size
    return { x: 760, y: 80 + i * 150 }
  }

  const syncViewFieldControl = (vf: ViewFieldState) => {
    const node = viewNodeById.get(vf.id)
    if (!node) return
    const existing = node.controls?.viewField
    if (
      isReteViewFieldControl(existing) &&
      existing.fieldName === vf.fieldName &&
      existing.formula === vf.formula &&
      existing.overrideFieldName === vf.overrideFieldName
    ) {
      return
    }
    replaceViewFieldControl(node, vf)
  }

  const refreshViewFieldNode = async (viewFieldId: string) => {
    const node = viewNodeById.get(viewFieldId)
    if (!node) return
    await area.update('node', String(node.id))
  }

  const refreshAllViewFieldNodes = async () => {
    for (const id of viewNodeById.keys()) {
      await refreshViewFieldNode(id)
    }
  }

  const handle: MappingEditorHandle = {
    destroy() {
      ;(area as unknown as { destroy?: () => void }).destroy?.()
      ;(render as unknown as { destroy?: () => void }).destroy?.()
      ;(editor as unknown as { destroy?: () => void }).destroy?.()
      container.replaceChildren()
    },

    async addEntityFieldNode(fieldName: string, displayName?: string) {
      if (entityFieldNodeByName.has(fieldName)) return
      const node = new EntityFieldNode(fieldName, displayName)
      await editor.addNode(node)
      const pos = nextEntityPlacement()
      await area.translate(node.id, pos)
      entityFieldNodeByName.set(fieldName, node)
      entityFieldPosByName.set(fieldName, pos)
      emitCanvasEntityFields()
    },

    async addViewFieldNode(state: ViewFieldState) {
      if (viewNodeById.has(state.id)) {
        syncViewFieldControl(state)
        return
      }

      const node = new ViewFieldNode(state.id)
      const control = asViewFieldControl({
        viewFieldId: state.id,
        fieldName: state.fieldName,
        formula: state.formula,
        overrideFieldName: state.overrideFieldName,
        syncRevision: 0,
        onPatch: (patch) => callbacks.onViewFieldPatch?.(patch),
      })
      node.addControl('viewField', control as never)

      await editor.addNode(node)
      const pos = viewFieldPosById.get(state.id) ?? nextViewPlacement()
      await area.translate(node.id, pos)
      viewFieldPosById.set(state.id, pos)
      viewNodeById.set(state.id, node)
      // 初回 addNode 直後は lit control が DOM に載らないことがある
      await refreshViewFieldNode(state.id)
    },

    async connectEntityFieldToView(entityFieldName: string, viewFieldId: string) {
      const entityNode = entityFieldNodeByName.get(entityFieldName)
      const viewNode = viewNodeById.get(viewFieldId)
      if (!entityNode || !viewNode) return

      const entityReteId = resolveNodeId(entityNode.id)
      const viewReteId = resolveNodeId(viewNode.id)

      for (const con of [...editor.getConnections()]) {
        if (
          resolveNodeId(con.target) === viewReteId ||
          resolveNodeId(con.source) === entityReteId
        ) {
          await editor.removeConnection(con.id)
        }
      }

      const link = new ClassicPreset.Connection(
        entityNode as ClassicPreset.Node,
        'value',
        viewNode,
        'in',
      )
      await editor.addConnection(link)
      scheduleConnectionSync()
    },

    async removeViewFieldNode(viewFieldId: string) {
      const node = viewNodeById.get(viewFieldId)
      if (!node) return
      for (const con of [...editor.getConnections()]) {
        if (resolveNodeId(con.target) === resolveNodeId(node.id)) {
          await editor.removeConnection(con.id)
        }
      }
      await editor.removeNode(node.id)
      viewNodeById.delete(viewFieldId)
      viewFieldPosById.delete(viewFieldId)
      emitConnections(true)
    },

    syncViewFields(viewFields: ViewFieldState[]) {
      for (const vf of viewFields) {
        syncViewFieldControl(vf)
      }
    },

    refreshViewFieldNode,

    refreshAllViewFieldNodes,
  }

  // ViewField は親（bizmarche-converter-mapping）の viewFields から addViewFieldNode で追加する
  return handle
}
