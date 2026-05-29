import type { IndexAppQuery, IndexAppViewSchema } from './types'
import type { EntitySchemaState } from '../entity-schema/types'
import type { ViewFieldState } from '../mapping/view-field-state'
import { buildEntitySchemaPart } from './serialize-entity'

/** viewFields から ViewSchema 部分を組み立て */
export function buildViewSchemaPart(
  viewFields: ViewFieldState[],
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

  return fields.length > 0 ? { fields } : {}
}

/** コンバーターに渡す IndexAppQuery 全体を組み立て */
export function buildIndexAppQuery(params: {
  targetSearchPath: string
  entitySchemaState: EntitySchemaState
  viewFields: ViewFieldState[]
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

  const viewSchema = buildViewSchemaPart(params.viewFields)
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
}): string {
  return JSON.stringify(buildIndexAppQuery(params), null, 2)
}
