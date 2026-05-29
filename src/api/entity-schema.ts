import { apiConfig } from './config'

/** schemaPath で EntitySchema JSON テキストを取得 */
export async function getEntitySchemaText(schemaPath: string): Promise<string> {
  const params = new URLSearchParams({
    bucketCode: apiConfig.bucketCodeMapping,
    fileSystemId: schemaPath.trim(),
  })
  const res = await fetch(`${apiConfig.fileSystemApiUrl}?${params}`)
  if (!res.ok) {
    throw new Error(`EntitySchema取得失敗: ${res.status} ${res.statusText}`)
  }
  return res.text()
}
