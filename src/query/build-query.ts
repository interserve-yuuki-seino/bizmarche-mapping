import type { IndexAppQuery, IndexAppViewSchema } from './types'
import type { EntitySchemaState } from '../entity-schema/types'
import type { ViewFieldState } from '../mapping/view-field-state'
import { buildEntitySchemaPart } from './serialize-entity'

/** viewFields から ViewSchema 部分を組み立て */
export function buildViewSchemaPart(
  viewFields: ViewFieldState[],
  rowExpands: string[] = [],
): IndexAppViewSchema {
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
  return out
}

/** コンバーターに渡す IndexAppQuery 全体を組み立て */
export function buildIndexAppQuery(params: {
  targetSearchPath: string
  entitySchemaState: EntitySchemaState
  viewFields: ViewFieldState[]
  rowExpands?: string[]
}): IndexAppQuery {
  const query: IndexAppQuery = {}

  const searchPath = params.targetSearchPath.trim()
  if (searchPath) {
    query.target = { searchPath }
  }

  const entitySchema = buildEntitySchemaPart(params.entitySchemaState)
  if (Object.keys(entitySchema).length > 0) {
    query.entitySchema = entitySchema
  }

  const viewSchema = buildViewSchemaPart(
    params.viewFields,
    params.rowExpands ?? [],
  )
  if (Object.keys(viewSchema).length > 0) {
    query.viewSchema = viewSchema
  }

  return query
}

/** IndexAppQuery を JSON 文字列化 */
export function buildQueryJson(params: {
  targetSearchPath: string
  entitySchemaState: EntitySchemaState
  viewFields: ViewFieldState[]
  rowExpands?: string[]
}): string {
  return JSON.stringify(buildIndexAppQuery(params), null, 2)
}
