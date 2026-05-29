/** API 接続先（環境に合わせて差し替え） */
export const apiConfig = {
  fileSystemApiUrl:
    'http://index-core-api.isbe.in.nakamenosakura.com/api/fileSystem',
  convertApiUrl:
    'http://index-core-convert-api.isbe.in.nakamenosakura.com/api',
  bucketCodeMapping: 'biz-marche-convert-management',
  entitySchemaCatalogPath: 'settings/test/entitySchema/catalog',
  viewSchemaCatalogPath: 'settings/test/viewSchema/catalog',
} as const
