/** rowExpands 編集用の1行 */
export type RowExpandEntry = {
  id: string
  fieldName: string
}

export function createRowExpandEntry(fieldName = ''): RowExpandEntry {
  return {
    id: crypto.randomUUID(),
    fieldName,
  }
}

/** 文字列配列から編集用エントリを生成 */
export function rowExpandsFromStrings(names: string[]): RowExpandEntry[] {
  return names.map((name) => createRowExpandEntry(name))
}

/** 空文字・重複を除外し、IndexAppQuery 用の rowExpands を返す（順序維持） */
export function normalizeRowExpands(entries: RowExpandEntry[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of entries) {
    const name = entry.fieldName.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}
