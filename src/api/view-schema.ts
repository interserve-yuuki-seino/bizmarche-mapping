import { apiConfig } from './config'
import type { IndexAppViewSchema } from '../query/types'

/** API レスポンスから ViewSchema 本体を取り出す */
function normalizeViewSchemaResponse(value: unknown): IndexAppViewSchema {
  if (!value || typeof value !== 'object') return {}

  const obj = value as Record<string, unknown>
  if ('fields' in obj || 'rowExpands' in obj) {
    return value as IndexAppViewSchema
  }

  if ('data' in obj) {
    return normalizeViewSchemaResponse(obj.data)
  }

  return {}
}

/** schemaPath で ViewSchema JSON を取得（/models エンドポイント） */
export async function getViewSchema(
  schemaPath: string,
): Promise<IndexAppViewSchema> {
  const params = new URLSearchParams({
    bucketCode: apiConfig.bucketCodeMapping,
    fileSystemId: schemaPath.trim(),
  })
  const res = await fetch(`${apiConfig.fileSystemApiUrl}/models?${params}`)
  if (!res.ok) {
    throw new Error(`ViewSchema取得失敗: ${res.status} ${res.statusText}`)
  }
  const json: unknown = await res.json()
  return normalizeViewSchemaResponse(json)
}
