export interface DocumentHeading {
  title: string
  level: 1 | 2 | 3
  /** Inclusive start offset of the heading line (after leading whitespace). */
  start: number
  /** Exclusive end offset of the heading line (before newline). */
  end: number
}

function headingLevel(trimmed: string): 1 | 2 | 3 | null {
  if (
    /^第[一二三四五六七八九十\d]+[章节部分篇]/u.test(trimmed) ||
    /^[一二三四五六七八九十]+[、．.]/u.test(trimmed) ||
    /^#{1}\s+\S/u.test(trimmed)
  ) {
    return 1
  }
  if (
    /^（[一二三四五六七八九十\d]+）/u.test(trimmed) ||
    /^\([一二三四五六七八九十\d]+\)/u.test(trimmed) ||
    /^#{2}\s+\S/u.test(trimmed)
  ) {
    return 2
  }
  if (/^\d+[、．.]\s*\S/u.test(trimmed) || /^#{3}\s+\S/u.test(trimmed)) {
    return 3
  }
  return null
}

/** Extract real heading lines from document body for a Word-like TOC. */
export function extractDocumentHeadings(content: string, limit = 80): DocumentHeading[] {
  const normalized = content.replace(/\r\n/g, '\n')
  if (!normalized.trim()) return []

  const headings: DocumentHeading[] = []
  let offset = 0
  for (const line of normalized.split('\n')) {
    const lead = line.match(/^\s*/)?.[0].length ?? 0
    const trimmed = line.trim()
    const level = trimmed ? headingLevel(trimmed) : null
    if (level) {
      const title = trimmed.replace(/^#+\s*/, '')
      headings.push({
        title,
        level,
        start: offset + lead,
        end: offset + line.length,
      })
      if (headings.length >= limit) break
    }
    offset += line.length + 1
  }
  return headings
}
