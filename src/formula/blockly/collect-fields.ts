import type { FormulaExpr } from '../ast'
import { isConditionExpr } from '../ast'

/** AST から参照される項目名を収集 */
export function collectFieldNamesFromAst(expr: FormulaExpr): string[] {
  const names = new Set<string>()
  walk(expr, names)
  return [...names]
}

function walk(expr: FormulaExpr, names: Set<string>): void {
  switch (expr.type) {
    case 'field':
      if (expr.name.trim()) names.add(expr.name)
      break
    case 'condition':
      if (expr.field.trim()) names.add(expr.field)
      break
    case 'literal':
      break
    case 'call':
      for (const arg of expr.args) {
        if (isConditionExpr(arg)) walkCondition(arg, names)
        else walk(arg, names)
      }
      break
  }
}

function walkCondition(cond: Extract<FormulaExpr, { type: 'condition' }>, names: Set<string>): void {
  if (cond.field.trim()) names.add(cond.field)
}

/** 既存候補と AST 由来の項目名をマージ */
export function mergeFieldNames(
  base: string[],
  fromAst: string[],
): string[] {
  const set = new Set(base.map((n) => n.trim()).filter(Boolean))
  for (const n of fromAst) {
    if (n.trim()) set.add(n.trim())
  }
  return [...set]
}
