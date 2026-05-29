import type { IndexAppEntitySchema } from '../query/types'

export type EntityFieldRow = {
  fieldName: string
  displayName?: string
  fieldType?: string
  length?: number
  count?: number
  trimType?: string
}

/** UI 表示用ラベル（displayName があれば優先） */
export function entityFieldDisplayLabel(
  field: Pick<EntityFieldRow, 'fieldName' | 'displayName'>,
): string {
  const display = field.displayName?.trim()
  return display || field.fieldName
}

/** 入力文字列を fieldName に解決（displayName 入力にも対応） */
export function resolveEntityFieldName(
  input: string,
  fields: EntityFieldRow[],
): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (fields.some((f) => f.fieldName === trimmed)) return trimmed
  const byDisplay = fields.find((f) => f.displayName?.trim() === trimmed)
  if (byDisplay) return byDisplay.fieldName
  return trimmed
}

/** fieldName から Entity フィールド行を検索 */
export function findEntityFieldByName(
  fieldName: string,
  fields: EntityFieldRow[],
): EntityFieldRow | undefined {
  const name = fieldName.trim()
  if (!name) return undefined
  return fields.find((f) => f.fieldName === name)
}

export type EntitySchemaState = {
  /** path: schemaPath 参照 / inline: インライン定義 */
  mode: 'path' | 'inline'
  schemaPath: string
  definition: IndexAppEntitySchema
}
