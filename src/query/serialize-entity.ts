import type { IndexAppEntitySchema } from './types'
import type { EntitySchemaState } from '../entity-schema/types'

function omitEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out as Partial<T>
}

/** EntitySchema 部分を Query JSON 用にシリアライズ */
export function buildEntitySchemaPart(
  state: EntitySchemaState,
): IndexAppEntitySchema {
  const path = state.schemaPath.trim()
  if (state.mode === 'path' && path) {
    return { schemaPath: path }
  }
  return omitEmpty(state.definition) as IndexAppEntitySchema
}
