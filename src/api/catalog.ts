import { apiConfig } from './config'

/** カタログ行の profiles（確認用テストデータ等） */
export type EntitySchemaCatalogProfiles = {
  /** IndexAppQuery target.searchPath */
  target?: string
  /** EntitySchema の fileSystemId */
  entitySchema?: string
  schemaPath?: string
}

export type EntitySchemaCatalogItem = {
  id: string
  name?: string
  schemaPath?: string
  targetSearchPath?: string
  profiles?: EntitySchemaCatalogProfiles
}

function readProfiles(row: object): EntitySchemaCatalogProfiles | undefined {
  const raw = (row as { profiles?: unknown }).profiles
  if (!raw || typeof raw !== 'object') return undefined

  const p = raw as Record<string, unknown>
  const profiles: EntitySchemaCatalogProfiles = {}
  if (typeof p.target === 'string' && p.target.trim()) {
    profiles.target = p.target.trim()
  }
  if (typeof p.entitySchema === 'string' && p.entitySchema.trim()) {
    profiles.entitySchema = p.entitySchema.trim()
  }
  if (typeof p.schemaPath === 'string' && p.schemaPath.trim()) {
    profiles.schemaPath = p.schemaPath.trim()
  }
  return Object.keys(profiles).length > 0 ? profiles : undefined
}

/** カタログ 1 件から schemaPath の既定値を決める */
export function resolveCatalogSchemaPath(item: EntitySchemaCatalogItem): string {
  return (
    item.schemaPath?.trim() ||
    item.profiles?.entitySchema?.trim() ||
    item.profiles?.schemaPath?.trim() ||
    `settings/test/entitySchema/${item.id}`
  )
}

/** カタログ 1 件から target.searchPath を決める */
export function resolveCatalogTargetSearchPath(
  item: EntitySchemaCatalogItem,
): string | undefined {
  const path = item.targetSearchPath?.trim() || item.profiles?.target?.trim()
  return path || undefined
}

function normalizeCatalogResponse(value: unknown): EntitySchemaCatalogItem[] {
  const arr = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && 'data' in value
      ? (value as { data: unknown }).data
      : null
  if (!Array.isArray(arr)) return []

  return arr.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const id = typeof (row as { id?: unknown }).id === 'string' ? (row as { id: string }).id : ''
    if (!id) return []
    const name =
      typeof (row as { name?: unknown }).name === 'string'
        ? (row as { name: string }).name
        : undefined
    const profiles = readProfiles(row)
    const schemaPath =
      typeof (row as { schemaPath?: unknown }).schemaPath === 'string'
        ? (row as { schemaPath: string }).schemaPath.trim()
        : profiles?.entitySchema || profiles?.schemaPath || undefined
    const targetSearchPath =
      typeof (row as { targetSearchPath?: unknown }).targetSearchPath === 'string'
        ? (row as { targetSearchPath: string }).targetSearchPath.trim()
        : profiles?.target

    const item: EntitySchemaCatalogItem = {
      id,
      name,
      profiles,
    }
    if (schemaPath) item.schemaPath = schemaPath
    if (targetSearchPath) item.targetSearchPath = targetSearchPath
    return [item]
  })
}

/** EntitySchema カタログ一覧を取得 */
export async function getEntitySchemaCatalog(
  catalogPath: string = apiConfig.entitySchemaCatalogPath,
): Promise<EntitySchemaCatalogItem[]> {
  const path = catalogPath.trim() || apiConfig.entitySchemaCatalogPath
  const params = new URLSearchParams({
    bucketCode: apiConfig.bucketCodeMapping,
    fileSystemId: path,
  })
  const res = await fetch(`${apiConfig.fileSystemApiUrl}/models?${params}`)
  if (!res.ok) {
    throw new Error(`カタログ取得失敗: ${res.status} ${res.statusText}`)
  }
  const json: unknown = await res.json()
  return normalizeCatalogResponse(json)
}
