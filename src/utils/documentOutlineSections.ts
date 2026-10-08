import { detectOutlineLevel } from './documentStructureAnalysis'
import { locateOutlineHeadingInContent } from './documentLocate'
import { extractDocumentHeadings } from './documentHeadings'
import { classifyOfficialLines } from './docxFormattedExport'

export const SHORT_SECTION_CHAR_THRESHOLD = 80

export interface OutlineSectionRange {
  title: string
  headingStart: number
  headingEnd: number
  bodyStart: number
  sectionEnd: number
}

export interface OutlineDirectoryEntry {
  title: string
  found: boolean
  charCount: number
  short: boolean
  level?: 1 | 2 | 3
  section: OutlineSectionRange | null
}

function lineEndAt(content: string, offset: number): number {
  const nextBreak = content.indexOf('\n', offset)
  return nextBreak < 0 ? content.length : nextBreak
}

function countSectionChars(text: string): number {
  const compact = text.replace(/\s+/g, '')
  return compact.length
}

function locateHeadingStart(content: string, title: string): number | null {
  const hit = locateOutlineHeadingInContent(content, title)
  if (!hit) return null
  return hit.start
}

/**
 * Resolve one outline item to a section range:
 * heading line → next same-or-higher level heading (or end of document).
 * Body starts after the heading line.
 */
export function resolveOutlineSectionRange(
  content: string,
  outline: string[],
  title: string,
): OutlineSectionRange | null {
  const index = outline.indexOf(title)
  if (index < 0) return null

  const anchors = outline.map((item) => ({
    title: item,
    level: detectOutlineLevel(item),
    start: locateHeadingStart(content, item),
  }))

  const current = anchors[index]
  if (!current || current.start == null) return null

  const headingStart = current.start
  const headingEnd = lineEndAt(content, headingStart)
  let bodyStart = headingEnd
  if (content[bodyStart] === '\n') bodyStart += 1

  const bodyEnd = documentBodyEndBeforeSignature(content)
  let sectionEnd = bodyEnd
  for (let i = index + 1; i < anchors.length; i += 1) {
    const next = anchors[i]
    if (next.start == null || next.start <= headingStart) continue
    if (next.level <= current.level) {
      sectionEnd = Math.min(next.start, bodyEnd)
      break
    }
  }
  sectionEnd = Math.max(headingEnd, Math.min(sectionEnd, bodyEnd))

  return {
    title,
    headingStart,
    headingEnd,
    bodyStart: Math.min(bodyStart, sectionEnd),
    sectionEnd,
  }
}

export function buildOutlineDirectory(
  content: string,
  outline: string[],
): OutlineDirectoryEntry[] {
  return outline.map((title) => {
    const section = resolveOutlineSectionRange(content, outline, title)
    if (!section) {
      return { title, found: false, charCount: 0, short: false, section: null }
    }
    const body = content.slice(section.bodyStart, section.sectionEnd)
    const charCount = countSectionChars(body)
    return {
      title,
      found: true,
      charCount,
      short: charCount < SHORT_SECTION_CHAR_THRESHOLD,
      section,
    }
  })
}

/** End offset of document body, excluding trailing 落款 (org + date). */
export function documentBodyEndBeforeSignature(content: string): number {
  const normalized = content.replace(/\r\n/g, '\n')
  if (!normalized) return 0
  const lines = normalized.split('\n')
  const kinds = classifyOfficialLines(lines)
  let endLine = lines.length
  for (let i = 0; i < kinds.length; i += 1) {
    if (kinds[i] === 'signatureOrg' || kinds[i] === 'signatureDate') {
      endLine = i
      break
    }
  }
  while (endLine > 0 && !lines[endLine - 1]!.trim()) endLine -= 1

  if (endLine >= lines.length) return normalized.length

  let offset = 0
  for (let i = 0; i < endLine; i += 1) {
    offset += lines[i]!.length + 1
  }
  return offset
}

/** Word-like TOC: built only from real heading lines in the body. */
export function buildDocumentTocDirectory(content: string): OutlineDirectoryEntry[] {
  const headings = extractDocumentHeadings(content)
  if (headings.length === 0) return []

  const bodyEnd = documentBodyEndBeforeSignature(content)

  return headings.map((heading, index) => {
    const headingStart = heading.start
    const headingEnd = heading.end
    let bodyStart = headingEnd
    if (content[bodyStart] === '\n') bodyStart += 1

    let sectionEnd = bodyEnd
    for (let i = index + 1; i < headings.length; i += 1) {
      const next = headings[i]!
      if (next.level <= heading.level) {
        sectionEnd = Math.min(next.start, bodyEnd)
        break
      }
    }
    sectionEnd = Math.max(headingEnd, Math.min(sectionEnd, bodyEnd))

    const section: OutlineSectionRange = {
      title: heading.title,
      headingStart,
      headingEnd,
      bodyStart: Math.min(bodyStart, sectionEnd),
      sectionEnd,
    }
    const charCount = countSectionChars(content.slice(section.bodyStart, section.sectionEnd))
    return {
      title: heading.title,
      found: true,
      charCount,
      short: charCount < SHORT_SECTION_CHAR_THRESHOLD,
      level: heading.level,
      section,
    }
  })
}
