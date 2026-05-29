import { apiConfig } from './config'
import type { IndexAppQuery } from '../query/types'

/** converter/query のレスポンス（ResultInfo 形式） */
export type ConverterQueryResult = {
  resultCode: number
  resultMessage: string | null
  data: unknown
}

/** IndexAppQuery でコンバーターを実行 */
export async function postConverterQuery(
  query: IndexAppQuery,
): Promise<ConverterQueryResult> {
  const params = new URLSearchParams({
    bucketCode: apiConfig.bucketCodeMapping,
  })
  const url = `${apiConfig.convertApiUrl}/converter/query?${params}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(query),
  })

  const text = await res.text()
  let body: unknown = text
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      body = text
    }
  }

  if (!res.ok) {
    const msg =
      body &&
      typeof body === 'object' &&
      'resultMessage' in body &&
      typeof (body as { resultMessage: unknown }).resultMessage === 'string'
        ? (body as { resultMessage: string }).resultMessage
        : `converter 呼び出し失敗: ${res.status} ${res.statusText}`
    throw new Error(msg)
  }

  if (body && typeof body === 'object' && 'resultCode' in body) {
    return body as ConverterQueryResult
  }

  return {
    resultCode: 0,
    resultMessage: null,
    data: body,
  }
}
