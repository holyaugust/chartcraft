import {
  getLayoutSpec,
  type LayoutPageSpec,
  type LayoutRoleStyle,
} from '../data/documentLayoutSpecs'
import {
  classifyOfficialParagraph,
  type OfficialParagraphKind,
} from './docxFormattedExport'

const OWN_INDENT = /^[ \t\u3000]/u

function lineHeightCss(page: LayoutPageSpec): string {
  return page.lineRule === 'exact' ? `${page.line / 20}pt` : String(page.line / 240)
}

function inlineStyleForRole(
  style: LayoutRoleStyle,
  page: LayoutPageSpec,
  applyIndent: boolean,
): string {
  const parts = [
    `font-family:${style.fontFamily}`,
    `font-size:${style.sizeHalfPoints / 2}pt`,
    `font-weight:${style.bold ? 'bold' : 'normal'}`,
    `text-align:${style.align === 'both' ? 'justify' : style.align}`,
    `line-height:${lineHeightCss(page)}`,
  ]
  if (style.color) {
    parts.push(`color:#${style.color}`)
  }
  if (applyIndent && style.firstLineIndentChars) {
    parts.push(`text-indent:${style.firstLineIndentChars / 100}em`)
  }
  return parts.join(';')
}

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

  const spec = getLayoutSpec('official')
  const parts: string[] = []
  let previousKind: OfficialParagraphKind | undefined

  for (const line of lines) {
    const kind = classifyOfficialParagraph(line, previousKind)
    if (kind !== 'skip') previousKind = kind

    if (kind === 'skip') {
      parts.push('<div class="doc-layout-gap" aria-hidden="true"></div>')
      continue
    }

    const text = escapeHtml(unwrapMarkerLine(line) || ' ')
    const roleStyle = spec.roles[kind] ?? spec.roles.body
    const styleAttr = inlineStyleForRole(roleStyle, spec.page, !OWN_INDENT.test(line))
    parts.push(
      `<p class="doc-layout-p doc-layout-${kind}" style="${styleAttr}">${text}</p>`,
    )
  }

  return parts.join('')
}
