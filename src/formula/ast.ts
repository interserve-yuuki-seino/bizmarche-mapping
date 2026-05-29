/** フェーズ1: formula AST ノード */

export type CompareOp = '==' | 'in'

/** 項目参照（alias 省略形） */
export type FieldExpr = {
  type: 'field'
  name: string
}

/** 数値またはシングルクォート文字列 */
export type LiteralExpr = {
  type: 'literal'
  value: string | number
}

/** iif の条件（field op operand） */
export type ConditionExpr = {
  type: 'condition'
  field: string
  op: CompareOp
  /** == のときは string | number、in のときは string[] */
  operand: string | number | string[]
}

/** 関数呼び出し（iif / expandNo） */
export type CallExpr = {
  type: 'call'
  name: string
  args: FormulaExpr[]
}

export type FormulaExpr = FieldExpr | LiteralExpr | ConditionExpr | CallExpr

export function isFieldExpr(e: FormulaExpr): e is FieldExpr {
  return e.type === 'field'
}

export function isLiteralExpr(e: FormulaExpr): e is LiteralExpr {
  return e.type === 'literal'
}

export function isConditionExpr(e: FormulaExpr): e is ConditionExpr {
  return e.type === 'condition'
}

export function isCallExpr(e: FormulaExpr): e is CallExpr {
  return e.type === 'call'
}
