import type { IndexAppViewSchema } from '../query/types'
import { rowExpandsFromStrings, type RowExpandEntry } from './row-expands-state'
import { createViewFieldState, type ViewFieldState } from './view-field-state'

/** ViewSchema JSON からエディタ状態へ変換（トップレベル fields のみ） */
export function viewStateFromViewSchema(schema: IndexAppViewSchema): {
  viewFields: ViewFieldState[]
  rowExpands: RowExpandEntry[]
} {
  const viewFields = (schema.fields ?? []).flatMap((f) => {
    const fieldName = f.fieldName?.trim()
    if (!fieldName) return []
    const formula = f.formula?.trim() || fieldName
    return [
      {
        ...createViewFieldState(),
        fieldName,
        formula,
        overrideFieldName: false,
      },
    ]
  })

  const rowExpands = rowExpandsFromStrings(schema.rowExpands ?? [])
  return { viewFields, rowExpands }
}
