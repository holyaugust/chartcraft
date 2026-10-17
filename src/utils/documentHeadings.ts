/** 「一、」后可跟年份；「一．2」这种点号+数字不当作一级标题 */
export const HEADING1_PREFIX_RE =
  /^[一二三四五六七八九十百零〇]+(?:、|[．.](?!\d))/u

export type HeadingOutlineLevel = 1 | 2 | 3 | 4

export interface DocumentHeading {
  title: string
  level: HeadingOutlineLevel
  /** Inclusive start offset of the heading line (after leading whitespace). */
  start: number
  /** Exclusive end offset of the heading line (before newline). */
  end: number
}

/**
 * Canonical GB/T-style heading level from a trimmed line.
 * Shared by TOC, format layout (via detectHeadingLevel), and structural proofread.
 */
export function resolveHeadingOutlineLevel(trimmed: string): HeadingOutlineLevel | null {
  if (!trimmed) return null
  if (/^#{1}\s+\S/u.test(trimmed)) return 1
  if (/^#{2}\s+\S/u.test(trimmed)) return 2
  if (/^#{3}\s+\S/u.test(trimmed)) return 3
  if (/^第[一二三四五六七八九十\d]+[章节部分篇]/u.test(trimmed)) return 1
  if (HEADING1_PREFIX_RE.test(trimmed)) return 1
  if (/^（[一二三四五六七八九十百零〇]+）/u.test(trimmed)) return 2
  if (/^\([一二三四五六七八九十百零〇]+\)/u.test(trimmed)) return 2
  if (/^（\d+）/u.test(trimmed)) return 4
  if (/^\(\d+\)/u.test(trimmed)) return 4

  // 三级：短行阿拉伯数字序号；允许末尾句读标点（校对可再单独提示去掉）
  if (/^\d{4}年/u.test(trimmed)) return null
  const withoutTrailPunct = trimmed.replace(/[。．.！？]+$/u, '')
  if (
    /^\d+[．.、]\s*\S/u.test(trimmed) &&
    withoutTrailPunct.length <= 48 &&
    !/[；]/.test(withoutTrailPunct)
  ) {
    return 3
  }
  return null
}

/** True when the line uses arabic digits as the primary marker (1、/1./（1）). */
export function isArabicHeadingMarker(trimmed: string): boolean {
  return /^\d+[、．.]/u.test(trimmed) || /^（\d+）/u.test(trimmed) || /^\(\d+\)/u.test(trimmed)
}

export function isChineseLevel1Marker(trimmed: string): boolean {
  return HEADING1_PREFIX_RE.test(trimmed) || /^第[一二三四五六七八九十\d]+[章节部分篇]/u.test(trimmed)
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
    const level = trimmed ? resolveHeadingOutlineLevel(trimmed) : null
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
