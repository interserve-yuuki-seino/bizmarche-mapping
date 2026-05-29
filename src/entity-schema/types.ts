import type { IndexAppEntitySchema } from '../query/types'

export type EntityFieldRow = {
  fieldName: string
  displayName?: string
  fieldType?: string
  length?: number
  count?: number
  trimType?: string
}

export type EntitySchemaState = {
  /** path: schemaPath 参照 / inline: インライン定義 */
  mode: 'path' | 'inline'
  schemaPath: string
  definition: IndexAppEntitySchema
}
