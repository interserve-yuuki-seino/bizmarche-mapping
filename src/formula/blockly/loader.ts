import * as Blockly from 'blockly'
import type { ConditionExpr, FormulaExpr } from '../ast'
import { isCallExpr, isConditionExpr, isFieldExpr, isLiteralExpr } from '../ast'
import { parseFormula, tryParseFormula } from '../parser'
import {
  FORMULA_BLOCK_TYPES,
  setBlockFieldDropdown,
  setWorkspaceFieldNames,
} from './blocks'
import { collectFieldNamesFromAst, mergeFieldNames } from './collect-fields'

function quoteString(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function asSvg(block: Blockly.Block): Blockly.BlockSvg {
  return block as Blockly.BlockSvg
}

function renderBlock(block: Blockly.Block): void {
  const svg = asSvg(block)
  if (typeof svg.initSvg !== 'function') return
  svg.initSvg()
  svg.render()
}

function countTopBlocks(workspace: Blockly.Workspace): number {
  return workspace.getTopBlocks(false).filter((b) => !b.isInFlyout).length
}

/** 値ブロックを作成 */
function createValueBlock(
  workspace: Blockly.Workspace,
  expr: FormulaExpr,
): Blockly.BlockSvg {
  let block: Blockly.Block

  if (isFieldExpr(expr)) {
    block = workspace.newBlock(FORMULA_BLOCK_TYPES.FIELD_REF)
    renderBlock(asSvg(block))
    setBlockFieldDropdown(block, expr.name)
    return asSvg(block)
  }

  if (isLiteralExpr(expr)) {
    if (typeof expr.value === 'number') {
      block = workspace.newBlock(FORMULA_BLOCK_TYPES.LITERAL_NUMBER)
      block.setFieldValue(expr.value, 'NUM')
    } else {
      block = workspace.newBlock(FORMULA_BLOCK_TYPES.LITERAL_STRING)
      block.setFieldValue(expr.value, 'TEXT')
    }
    const svg = asSvg(block)
    renderBlock(svg)
    return svg
  }

  if (isCallExpr(expr)) {
    return createCallBlock(workspace, expr)
  }

  block = workspace.newBlock(FORMULA_BLOCK_TYPES.LITERAL_STRING)
  block.setFieldValue('', 'TEXT')
  const svg = asSvg(block)
  renderBlock(svg)
  return svg
}

function createConditionBlock(
  workspace: Blockly.Workspace,
  cond: ConditionExpr,
): Blockly.BlockSvg {
  let block: Blockly.Block

  if (cond.op === '==') {
    block = workspace.newBlock(FORMULA_BLOCK_TYPES.CONDITION_EQ)
    renderBlock(asSvg(block))
    setBlockFieldDropdown(block, cond.field)
    const rhs = createValueBlock(workspace, {
      type: 'literal',
      value: cond.operand as string | number,
    })
    block.getInput('RHS')!.connection!.connect(rhs.outputConnection!)
  } else {
    block = workspace.newBlock(FORMULA_BLOCK_TYPES.CONDITION_IN)
    renderBlock(asSvg(block))
    setBlockFieldDropdown(block, cond.field)
    const list = (cond.operand as string[]).map(quoteString).join(',')
    block.setFieldValue(list, 'LIST')
  }

  return asSvg(block)
}

function createCallBlock(
  workspace: Blockly.Workspace,
  expr: Extract<FormulaExpr, { type: 'call' }>,
): Blockly.BlockSvg {
  if (expr.name === 'iif' && expr.args.length >= 3) {
    const block = workspace.newBlock(FORMULA_BLOCK_TYPES.IIF)
    renderBlock(asSvg(block))

    const condArg = expr.args[0]
    if (isConditionExpr(condArg)) {
      const condBlock = createConditionBlock(workspace, condArg)
      block.getInput('COND')!.connection!.connect(condBlock.outputConnection!)
    }
    const trueBlock = createValueBlock(workspace, expr.args[1]!)
    const falseBlock = createValueBlock(workspace, expr.args[2]!)
    block.getInput('TRUE')!.connection!.connect(trueBlock.outputConnection!)
    block.getInput('FALSE')!.connection!.connect(falseBlock.outputConnection!)
    return asSvg(block)
  }

  if (expr.name === 'expandNo') {
    const block = workspace.newBlock(FORMULA_BLOCK_TYPES.EXPAND_NO)
    renderBlock(asSvg(block))

    const names = ['ARG0', 'ARG1', 'ARG2'] as const
    for (let i = 0; i < names.length; i++) {
      const arg = expr.args[i]
      if (!arg) continue
      const child = createValueBlock(workspace, arg)
      block.getInput(names[i]!)!.connection!.connect(child.outputConnection!)
    }
    return asSvg(block)
  }

  const fallback = workspace.newBlock(FORMULA_BLOCK_TYPES.LITERAL_STRING)
  fallback.setFieldValue('', 'TEXT')
  const svg = asSvg(fallback)
  renderBlock(svg)
  return svg
}

/** AST からワークスペースへブロックを配置（既存ブロックはクリア） */
export function loadFormulaAst(
  workspace: Blockly.Workspace,
  expr: FormulaExpr,
  fieldNames: string[] = [],
): void {
  const merged = mergeFieldNames(fieldNames, collectFieldNamesFromAst(expr))
  setWorkspaceFieldNames(workspace, merged)
  workspace.clear()
  setWorkspaceFieldNames(workspace, merged)
  createValueBlock(workspace, expr)
}

/** formula 文字列をパースして Blockly に復元 */
export function loadFormulaString(
  workspace: Blockly.Workspace,
  formula: string,
  fieldNames: string[] = [],
): { ok: true } | { ok: false; error: string } {
  const trimmed = formula.trim()
  if (!trimmed) {
    workspace.clear()
    return { ok: true }
  }

  const ast = tryParseFormula(trimmed)
  if (!ast) {
    return {
      ok: false,
      error: '式を解析できません。テキスト入力を確認してください。',
    }
  }

  try {
    loadFormulaAst(workspace, ast, fieldNames)
    if (countTopBlocks(workspace) === 0) {
      return { ok: false, error: 'ブロックの復元に失敗しました。' }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

/** パース検証用 */
export { parseFormula }
