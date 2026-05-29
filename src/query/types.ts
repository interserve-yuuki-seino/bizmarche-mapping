/** IndexCoreConvertApi の QueryTarget（対象データ） */
export type QueryTarget = {
  searchPath?: string
  appCode?: string
  jsonFileType?: string
  storageBasePath?: string
  compression?: string
  httpMethod?: string
  headers?: Record<string, string>
  baseObjectPath?: string
  requestContents?: unknown
  useYieldSerialize?: boolean
  splitConfig?: string
  splitFileType?: string
  responseContents?: unknown
}

/** エンティティスキーマ（CSV/固定長などのレイアウト定義） */
export type IndexAppEntitySchema = {
  schemaPath?: string
  contentsType?: string
  charset?: string
  crlf?: string
  csvSeparator?: string
  headerCount?: number
  multiLines?: boolean
  quoteStyle?: boolean
  fields?: IndexAppEntityField[]
}

export type IndexAppEntityField = {
  fieldName: string
  displayName?: string
  description?: string
  fieldType?: string
  format?: string
  charWidth?: string
  textAlignment?: string
  trimType?: string
  nullValue?: string
  children?: IndexAppEntityField[]
  dimensions?: unknown[]
  count?: number
  length?: number
}

/** Viewスキーマの表示項目 */
export type IndexAppViewField = {
  fieldName: string
  displayName?: string
  fieldType?: string
  formula?: string
  format?: string
  children?: IndexAppViewField[]
  dimensions?: unknown[]
  expand?: number[]
  value?: unknown
}

/** Viewスキーマ（変換定義） */
export type IndexAppViewSchema = {
  fields?: IndexAppViewField[]
  where?: string
  filters?: unknown[]
  mappings?: unknown[]
  groupBy?: string
  orderBy?: string
  skip?: number
  take?: number
  rowExpands?: string[]
}

/** IndexAppQuery モデル */
export type IndexAppQuery = {
  target?: QueryTarget
  entitySchema?: IndexAppEntitySchema
  viewSchema?: IndexAppViewSchema
  crossJoinOptions?: unknown
  child?: IndexAppQuery
}
