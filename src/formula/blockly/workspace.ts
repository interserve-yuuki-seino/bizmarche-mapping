import * as Blockly from 'blockly'
import {
  buildToolboxXml,
  registerFormulaBlocks,
  setWorkspaceFieldNames,
  updateFieldDropdowns,
  WS_FIELD_NAMES_KEY,
} from './blocks'
import { loadFormulaString } from './loader'
import {
  isFormulaWorkspaceComplete,
  workspaceToFormula,
} from './generator'
import { relayoutFormulaWorkspace, resizeFormulaWorkspace } from './workspace-layout'

/** shadow ブロックは見本表示のみ（編集・移動・削除不可） */
function lockShadowBlock(block: Blockly.Block): void {
  if (!block.isShadow()) return
  block.setEditable(false)
  block.setMovable(false)
  block.setDeletable(false)
}

/** ワークスペース内の既存 shadow をすべてロック */
function lockAllShadowBlocks(workspace: Blockly.Workspace): void {
  for (const block of workspace.getAllBlocks(false)) {
    lockShadowBlock(block)
  }
}

/** 新規作成された shadow ブロックを自動ロック */
function attachShadowBlockGuard(workspace: Blockly.Workspace): void {
  workspace.addChangeListener((e: Blockly.Events.Abstract) => {
    if (e.type !== Blockly.Events.BLOCK_CREATE) return
    const created = e as Blockly.Events.BlockCreate
    const ids = created.ids ?? (created.blockId ? [created.blockId] : [])
    for (const id of ids) {
      const block = workspace.getBlockById(id)
      if (block) lockShadowBlock(block)
    }
  })
  lockAllShadowBlocks(workspace)
}

export type FormulaWorkspaceHandle = {
  workspace: Blockly.WorkspaceSvg
  dispose: () => void
  setFieldNames: (names: string[]) => void
  loadFormula: (formula: string) => { ok: true } | { ok: false; error: string }
  getFormula: () => string
  isComplete: () => boolean
  relayout: () => void
  resize: () => void
}

/** Blockly ワークスペースをコンテナに作成 */
export async function createFormulaWorkspace(
  container: HTMLElement,
  options: {
    fieldNames?: string[]
  } = {},
): Promise<FormulaWorkspaceHandle> {
  const blockly = await import('blockly')
  await import('blockly/blocks')

  const fieldNames = options.fieldNames ?? []
  registerFormulaBlocks(fieldNames)

  const workspace = blockly.inject(container, {
    toolbox: buildToolboxXml(),
    grid: {
      spacing: 20,
      length: 3,
      colour: '#e5e7eb',
      snap: true,
    },
    zoom: {
      controls: true,
      wheel: true,
      startScale: 1,
      maxScale: 1.5,
      minScale: 0.5,
    },
    move: {
      scrollbars: true,
      drag: true,
      wheel: false,
    },
    trashcan: true,
    sounds: false,
  }) as Blockly.WorkspaceSvg

  updateFieldDropdowns(workspace, fieldNames)
  attachShadowBlockGuard(workspace)

  return {
    workspace,
    dispose() {
      workspace.dispose()
    },
    setFieldNames(names: string[]) {
      registerFormulaBlocks(names)
      updateFieldDropdowns(workspace, names)
      setWorkspaceFieldNames(workspace, names)
    },
    loadFormula(formula: string) {
      const ws = workspace as Blockly.Workspace & {
        [WS_FIELD_NAMES_KEY]?: string[]
      }
      const result = loadFormulaString(
        workspace,
        formula,
        ws[WS_FIELD_NAMES_KEY] ?? fieldNames,
      )
      if (result.ok) lockAllShadowBlocks(workspace)
      return result
    },
    getFormula() {
      return workspaceToFormula(workspace)
    },
    isComplete() {
      return isFormulaWorkspaceComplete(workspace)
    },
    relayout() {
      relayoutFormulaWorkspace(workspace)
    },
    resize() {
      resizeFormulaWorkspace(workspace)
    },
  }
}
