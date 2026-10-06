import { classifyOfficialLines } from './docxFormattedExport'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function unwrapMarkerLine(line: string): string {
  const trimmed = line.trim()
  const markerMatch = trimmed.match(/^【([^】]+)】$/)
  if (!markerMatch) return trimmed
  const inner = markerMatch[1]
  const colonIdx = inner.search(/[：:]/)
  if (colonIdx >= 0) {
    return inner.slice(colonIdx + 1).trim() || inner.slice(0, colonIdx).trim()
  }
  return inner.trim()
}

/** 将纯文本渲染为接近 GB/T 9704 的可读 HTML（仅预览，不改正文） */
export function buildOfficialLayoutHtml(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  if (lines.every((line) => !line.trim())) {
    return '<p class="doc-layout-empty">暂无正文</p>'
  }

  const kinds = classifyOfficialLines(lines)
  const parts: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!
    const kind = kinds[i] ?? 'skip'

    if (kind === 'skip') {
      parts.push('<div class="doc-layout-gap" aria-hidden="true"></div>')
      continue
    }

    const text = escapeHtml(unwrapMarkerLine(line) || ' ')
    parts.push(`<p class="doc-layout-p doc-layout-${kind}">${text}</p>`)
  }

  return parts.join('')
}
