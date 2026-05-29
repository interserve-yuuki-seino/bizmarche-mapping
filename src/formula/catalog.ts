/** 引数の種別（ブロックのソケット型に対応） */
export type ArgKind = 'field' | 'value' | 'condition'

export type FormulaFnArg = {
  name: string
  kind: ArgKind
  optional?: boolean
}

export type FormulaFn = {
  name: string
  label: string
  args: FormulaFnArg[]
}

/** フェーズ1: iif / expandNo のみ */
export const FORMULA_FUNCTIONS: FormulaFn[] = [
  {
    name: 'iif',
    label: '条件分岐 (iif)',
    args: [
      { name: 'condition', kind: 'condition' },
      { name: 'trueValue', kind: 'value' },
      { name: 'falseValue', kind: 'value' },
    ],
  },
  {
    name: 'expandNo',
    label: '展開番号 (expandNo)',
    args: [
      { name: 'fieldKey', kind: 'field', optional: true },
      { name: 'baseNo', kind: 'value', optional: true },
      { name: 'addFieldKey', kind: 'field', optional: true },
    ],
  },
]

/** フェーズ1 で GUI に出す比較演算子 */
export const PHASE1_COMPARE_OPS = ['==', 'in'] as const

export type Phase1CompareOp = (typeof PHASE1_COMPARE_OPS)[number]
