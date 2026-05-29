/** converter 結果 JSON の先頭プレビュー（全文は DL 用に別保持） */
export function buildConverterResultPreview(
  full: string,
  options?: { maxLines?: number; maxChars?: number },
): string {
  const maxLines = options?.maxLines ?? 80
  const maxChars = options?.maxChars ?? 8_000

  if (!full) return ''

  const lines = full.split('\n')
  let preview =
    lines.length > maxLines ? lines.slice(0, maxLines).join('\n') : full
  let truncated = lines.length > maxLines

  if (preview.length > maxChars) {
    preview = preview.slice(0, maxChars)
    truncated = true
  }

  if (!truncated) return preview

  const omittedLines =
    lines.length > maxLines ? lines.length - maxLines : 0
  const suffix =
    omittedLines > 0
      ? `\n... (${omittedLines} 行省略。全文はダウンロードしてください)`
      : '\n... (省略。全文はダウンロードしてください)'

  return preview + suffix
}
