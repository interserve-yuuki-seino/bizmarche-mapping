import type { IndexAppEntityField, IndexAppEntitySchema } from '../query/types'
import type { EntityFieldRow, EntitySchemaState } from './types'

export function createEmptyEntitySchemaState(): EntitySchemaState {
  return {
    mode: 'inline',
    schemaPath: '',
    definition: {},
  }
}

/** EntitySchema JSON テキストをパース */
export function parseEntitySchemaJson(text: string): IndexAppEntitySchema | null {
  try {
    const obj = JSON.parse(text) as unknown
    if (!obj || typeof obj !== 'object') return null
    return obj as IndexAppEntitySchema
  } catch {
    return null
  }
}

/** fields[] をパレット用に抽出 */
export function extractEntityFields(
  definition: IndexAppEntitySchema,
): EntityFieldRow[] {
  const fields = Array.isArray(definition.fields) ? definition.fields : []
  return fields.flatMap((f) => {
    const fieldName =
      typeof f.fieldName === 'string' ? f.fieldName.trim() : ''
    if (!fieldName) return []
    return [
      {
        fieldName,
        displayName:
          typeof f.displayName === 'string' ? f.displayName : undefined,
        fieldType: typeof f.fieldType === 'string' ? f.fieldType : undefined,
        length: typeof f.length === 'number' ? f.length : undefined,
        count: typeof f.count === 'number' ? f.count : undefined,
        trimType: typeof f.trimType === 'string' ? f.trimType : undefined,
      },
    ]
  })
}

/** EntitySchema のサマリー文字列 */
export function entitySchemaSummary(definition: IndexAppEntitySchema): string {
  const type = definition.contentsType ?? 'json'
  const charset = definition.charset ?? 'utf8'
  const count = extractEntityFields(definition).length
  return `${type} / ${charset} / ${count} fields`
}

/** schemaPath 選択時の状態 */
export function entitySchemaStateFromPath(schemaPath: string): EntitySchemaState {
  return {
    mode: 'path',
    schemaPath: schemaPath.trim(),
    definition: {},
  }
}

/** インライン定義反映時の状態 */
export function entitySchemaStateFromDefinition(
  definition: IndexAppEntitySchema,
  schemaPath = '',
): EntitySchemaState {
  const path = schemaPath.trim()
  return {
    mode: path ? 'path' : 'inline',
    schemaPath: path,
    definition,
  }
}

/** fields を正規化（不要キー除去は最小限） */
export function normalizeEntityField(
  raw: Record<string, unknown>,
): IndexAppEntityField | null {
  const fieldName =
    typeof raw.fieldName === 'string' ? raw.fieldName.trim() : ''
  if (!fieldName) return null
  const out: IndexAppEntityField = { fieldName }
  const keys = [
    'displayName',
    'description',
    'fieldType',
    'format',
    'charWidth',
    'textAlignment',
    'trimType',
    'nullValue',
    'count',
    'length',
  ] as const
  for (const k of keys) {
    const v = raw[k]
    if (v !== undefined && v !== null && v !== '') {
      ;(out as Record<string, unknown>)[k] = v
    }
  }
  return out
}
