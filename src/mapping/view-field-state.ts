import type { IndexAppViewSchema } from '../query/types'

export type ViewFieldState = {
  id: string
  fieldName: string
  formula: string
  overrideFieldName: boolean
}

export type ViewFieldConnection = {
  fromEntityFieldName: string
  toViewFieldId: string
}

export type ViewFieldPatch = {
  id: string
  fieldName?: string
  formula?: string
  overrideFieldName?: boolean
}

/** 接続を ViewField 状態へ反映（接続時は fieldName / formula を Entity 名で埋める） */
export function applyConnections(
  viewFields: ViewFieldState[],
  connections: ViewFieldConnection[],
  previousConnections: ViewFieldConnection[] = [],
): ViewFieldState[] {
  const byTo = new Map(
    connections.map((c) => [c.toViewFieldId, c.fromEntityFieldName]),
  )
  const prevByTo = new Map(
    previousConnections.map((c) => [c.toViewFieldId, c.fromEntityFieldName]),
  )

  return viewFields.map((vf) => {
    const from = byTo.get(vf.id)
    if (!from) {
      if (prevByTo.has(vf.id)) {
        return {
          ...vf,
          formula: '',
          fieldName: vf.overrideFieldName ? vf.fieldName : '',
          overrideFieldName: false,
        }
      }
      return vf
    }
    return {
      ...vf,
      fieldName: from,
      formula: from,
      overrideFieldName: false,
    }
  })
}

/** @deprecated buildQueryJson を使用 */
export function buildViewSchemaJson(
  viewFields: ViewFieldState[],
  rowExpands: string[] = [],
): string {
  const fields = viewFields
    .map((vf) => {
      const fieldName = vf.fieldName.trim()
      const formula = vf.formula.trim()
      if (!fieldName) return null
      const row: { fieldName: string; formula?: string } = { fieldName }
      if (formula) row.formula = formula
      return row
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const expands = rowExpands.map((x) => x.trim()).filter(Boolean)
  const out: IndexAppViewSchema = {}
  if (fields.length > 0) out.fields = fields
  if (expands.length > 0) out.rowExpands = expands
  return JSON.stringify({ viewSchema: out }, null, 2)
}

export function createViewFieldState(): ViewFieldState {
  return {
    id: crypto.randomUUID(),
    fieldName: '',
    formula: '',
    overrideFieldName: false,
  }
}
