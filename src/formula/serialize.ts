import type { ConditionExpr, FormulaExpr } from './ast'

/** 文字列リテラルをシングルクォートでエスケープ */
function quoteString(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function serializeLiteral(value: string | number): string {
  if (typeof value === 'number') return String(value)
  return quoteString(value)
}

function serializeCondition(c: ConditionExpr): string {
  if (c.op === '==') {
    const op = c.operand
    const rhs =
      typeof op === 'number' ? String(op) : quoteString(op as string)
    return `${c.field} == ${rhs}`
  }
  const list = (c.operand as string[]).map(quoteString).join(',')
  return `${c.field} in (${list})`
}

/** AST を formula 文字列へ（canonical） */
export function serializeFormula(expr: FormulaExpr): string {
  switch (expr.type) {
    case 'field':
      return expr.name
    case 'literal':
      return serializeLiteral(expr.value)
    case 'condition':
      return serializeCondition(expr)
    case 'call': {
      const args = expr.args.map(serializeFormula).join(', ')
      return `${expr.name}(${args})`
    }
    default:
      return ''
  }
}
