import * as Blockly from 'blockly'
import {
  buildToolboxXml,
  registerFormulaBlocks,
  setWorkspaceFieldNames,
  updateFieldDropdowns,
  WS_FIELD_NAMES_KEY,
} from './blocks'
import { loadFormulaString } from './loader'
import { workspaceToFormula } from './generator'

export type FormulaWorkspaceHandle = {
  workspace: Blockly.WorkspaceSvg
  dispose: () => void
  setFieldNames: (names: string[]) => void
  loadFormula: (formula: string) => { ok: true } | { ok: false; error: string }
  getFormula: () => string
}

/** Blockly ワークスペースをコンテナに作成 */
export async function createFormulaWorkspace(
  container: HTMLElement,
  options: {
    fieldNames?: string[]
    initialFormula?: string
  } = {},
): Promise<FormulaWorkspaceHandle> {
  const blockly = await import('blockly')
  // 組み込みブロック（controls 等）用。formula は自前定義のみ使用
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
      startScale: 0.9,
    },
    trashcan: true,
    sounds: false,
  }) as Blockly.WorkspaceSvg

  updateFieldDropdowns(workspace, fieldNames)

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
      return loadFormulaString(
        workspace,
        formula,
        ws[WS_FIELD_NAMES_KEY] ?? fieldNames,
      )
    },
    getFormula() {
      return workspaceToFormula(workspace)
    },
  }
}
