import * as Blockly from 'blockly'
import { FORMULA_BLOCK_TYPES } from './blocks'

const ORDER_ATOMIC = 0

/** formula 用文字列ジェネレータ */
export const formulaGenerator = new Blockly.Generator('Formula')

function quoteString(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** 入力に接続された実ブロック（shadow は未接続扱い） */
function inputTargetBlock(input: Blockly.Input | null): Blockly.Block | null {
  const connected = input?.connection?.targetBlock() ?? null
  return connected?.isShadow() ? null : connected
}

function valueCodeFromBlock(block: Blockly.Block | null): string {
  if (!block) return "''"
  const [code] = formulaGenerator.blockToCode(block)
  return typeof code === 'string' ? code : "''"
}

function conditionFromBlock(block: Blockly.Block | null): string {
  if (!block) return 'true'

  switch (block.type) {
    case FORMULA_BLOCK_TYPES.CONDITION_EQ: {
      const field = String(block.getFieldValue('FIELD') ?? '').trim()
      if (!field) return 'true'
      const rhsInput = block.getInput('RHS')
      const rhsBlock = inputTargetBlock(rhsInput ?? null)
      const rhs = valueCodeFromBlock(rhsBlock)
      return `${field} == ${rhs}`
    }
    case FORMULA_BLOCK_TYPES.CONDITION_IN: {
      const field = String(block.getFieldValue('FIELD') ?? '').trim()
      if (!field) return 'true'
      const listRaw = String(block.getFieldValue('LIST') ?? '').trim()
      // 既に 'a','b' 形式ならそのまま。そうでなければカンマ区切りをクォート付きに変換
      const inner = listRaw.includes("'")
        ? listRaw
        : listRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => quoteString(s.replace(/^'|'$/g, '')))
            .join(',')
      return `${field} in (${inner})`
    }
    default:
      return 'true'
  }
}

formulaGenerator.forBlock[FORMULA_BLOCK_TYPES.FIELD_REF] = (block) => {
  const name = block.getFieldValue('FIELD')
  return [name || "''", ORDER_ATOMIC]
}

formulaGenerator.forBlock[FORMULA_BLOCK_TYPES.LITERAL_NUMBER] = (block) => {
  return [String(block.getFieldValue('NUM')), ORDER_ATOMIC]
}

formulaGenerator.forBlock[FORMULA_BLOCK_TYPES.LITERAL_STRING] = (block) => {
  const t = String(block.getFieldValue('TEXT') ?? '')
  return [quoteString(t), ORDER_ATOMIC]
}

formulaGenerator.forBlock[FORMULA_BLOCK_TYPES.IIF] = (block) => {
  const cond = conditionFromBlock(
    inputTargetBlock(block.getInput('COND') ?? null),
  )
  const t = valueCodeFromBlock(
    inputTargetBlock(block.getInput('TRUE') ?? null),
  )
  const f = valueCodeFromBlock(
    inputTargetBlock(block.getInput('FALSE') ?? null),
  )
  return [`iif(${cond}, ${t}, ${f})`, ORDER_ATOMIC]
}

formulaGenerator.forBlock[FORMULA_BLOCK_TYPES.EXPAND_NO] = (block) => {
  const a0 = valueCodeFromBlock(
    inputTargetBlock(block.getInput('ARG0') ?? null),
  )
  const a1 = valueCodeFromBlock(
    inputTargetBlock(block.getInput('ARG1') ?? null),
  )
  const a2 = valueCodeFromBlock(
    inputTargetBlock(block.getInput('ARG2') ?? null),
  )
  return [`expandNo(${a0}, ${a1}, ${a2})`, ORDER_ATOMIC]
}

formulaGenerator.forBlock[FORMULA_BLOCK_TYPES.CONDITION_EQ] = () => {
  // 条件ブロックは valueToCode ではなく conditionFromBlock で処理
  return ['', ORDER_ATOMIC]
}

formulaGenerator.forBlock[FORMULA_BLOCK_TYPES.CONDITION_IN] = () => {
  return ['', ORDER_ATOMIC]
}

/** iif の COND に実ブロックが接続されているか */
function isIifComplete(block: Blockly.Block): boolean {
  return inputTargetBlock(block.getInput('COND') ?? null) !== null
}

/** ワークスペースの式が確定可能か（shadow のみの iif 条件は未完成） */
export function isFormulaWorkspaceComplete(
  workspace: Blockly.Workspace,
): boolean {
  const tops = workspace
    .getTopBlocks(true)
    .filter((b) => !b.isInFlyout && b.outputConnection)

  if (tops.length === 0) return true

  const block = tops[0]!
  if (block.type === FORMULA_BLOCK_TYPES.IIF) {
    return isIifComplete(block)
  }
  return true
}

/** ワークスペースからトップレベル formula 文字列を生成 */
export function workspaceToFormula(workspace: Blockly.Workspace): string {
  const tops = workspace
    .getTopBlocks(true)
    .filter((b) => !b.isInFlyout && b.outputConnection)

  if (tops.length === 0) return ''

  const block = tops[0]!
  const [code] = formulaGenerator.blockToCode(block)
  return typeof code === 'string' ? code.trim() : ''
}
