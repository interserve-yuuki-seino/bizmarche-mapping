import * as Blockly from 'blockly'
import { FORMULA_BLOCK_TYPES } from './blocks'

const ORDER_ATOMIC = 0

/** formula 用文字列ジェネレータ */
export const formulaGenerator = new Blockly.Generator('Formula')

function quoteString(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function conditionFromBlock(block: Blockly.Block | null): string {
  if (!block) return 'true'

  switch (block.type) {
    case FORMULA_BLOCK_TYPES.CONDITION_EQ: {
      const field = block.getFieldValue('FIELD')
      const rhs =
        formulaGenerator.valueToCode(block, 'RHS', ORDER_ATOMIC) || "''"
      return `${field} == ${rhs}`
    }
    case FORMULA_BLOCK_TYPES.CONDITION_IN: {
      const field = block.getFieldValue('FIELD')
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
  const cond = conditionFromBlock(block.getInputTargetBlock('COND'))
  const t = formulaGenerator.valueToCode(block, 'TRUE', ORDER_ATOMIC) || "''"
  const f = formulaGenerator.valueToCode(block, 'FALSE', ORDER_ATOMIC) || "''"
  return [`iif(${cond}, ${t}, ${f})`, ORDER_ATOMIC]
}

formulaGenerator.forBlock[FORMULA_BLOCK_TYPES.EXPAND_NO] = (block) => {
  const a0 = formulaGenerator.valueToCode(block, 'ARG0', ORDER_ATOMIC) || "''"
  const a1 = formulaGenerator.valueToCode(block, 'ARG1', ORDER_ATOMIC) || '0'
  const a2 = formulaGenerator.valueToCode(block, 'ARG2', ORDER_ATOMIC) || "''"
  return [`expandNo(${a0}, ${a1}, ${a2})`, ORDER_ATOMIC]
}

formulaGenerator.forBlock[FORMULA_BLOCK_TYPES.CONDITION_EQ] = () => {
  // 条件ブロックは valueToCode ではなく conditionFromBlock で処理
  return ['', ORDER_ATOMIC]
}

formulaGenerator.forBlock[FORMULA_BLOCK_TYPES.CONDITION_IN] = () => {
  return ['', ORDER_ATOMIC]
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
