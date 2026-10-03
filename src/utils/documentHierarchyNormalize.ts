/**
 * 公文层次序号规范化：一级用「一、」、二级「（一）」、三级「1.」
 */

const CN_NUMS = [
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
  '十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
]

function toChineseOrdinal(n: number): string | null {
  if (n < 1 || n > CN_NUMS.length) return null
  return CN_NUMS[n - 1]
}

function looksLikeTopLevelArabicHeading(trimmed: string): boolean {
  if (!/^\d+[、．.]\s*\S/u.test(trimmed)) return false
  if (/^\d{4}年/u.test(trimmed)) return false
  if (trimmed.includes('|')) return false
  if (trimmed.length > 48 && /[。；！？]$/u.test(trimmed)) return false
  const num = Number(trimmed.match(/^(\d+)/)?.[1] ?? 0)
  return num >= 1 && num <= 20
}

function isAttachmentContext(lines: string[], index: number): boolean {
  for (let i = index; i >= Math.max(0, index - 12); i -= 1) {
    const t = lines[i].trim()
    if (/^附件[：:]/u.test(t)) return true
    if (/^[一二三四五六七八九十]+[、．.]/u.test(t) || /^（[一二三四五六七八九十]+）/u.test(t)) {
      return false
    }
  }
  return false
}

function previousNonEmpty(lines: string[], index: number): string {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (lines[i].trim()) return lines[i].trim()
  }
  return ''
}

export interface HierarchyNormalizeResult {
  content: string
  convertedCount: number
  samples: Array<{ original: string; replacement: string }>
}

/** 将误用作一级标题的「1、/1.」转为「一、」，并统一括号/顿号写法 */
export function normalizeHierarchyNumbering(text: string): HierarchyNormalizeResult {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const samples: Array<{ original: string; replacement: string }> = []
  let convertedCount = 0

  const pushSample = (original: string, replacement: string) => {
    if (original === replacement) return
    convertedCount += 1
    if (samples.length < 8) samples.push({ original, replacement })
  }

  const arabicTopLevel = lines.map((line) => line.trim()).filter(looksLikeTopLevelArabicHeading)
  const chineseTopLevel = lines
    .map((line) => line.trim())
    .filter((line) => /^[一二三四五六七八九十百]+[、．.]/u.test(line))
  const shouldConvertArabicH1 =
    arabicTopLevel.length >= 2 && chineseTopLevel.length < arabicTopLevel.length

  const next = lines.map((line, index) => {
    if (!line.trim()) return line
    let trimmed = line.trim()

    // 半角括号二级 → 全角「（一）」
    const halfParen = trimmed.match(/^\(([\d一二三四五六七八九十百]+)\)\s*(.*)$/u)
    if (halfParen) {
      const replacement = halfParen[2] ? `（${halfParen[1]}）${halfParen[2]}` : `（${halfParen[1]}）`
      pushSample(trimmed, replacement)
      trimmed = replacement
    }

    // 「一.」→「一、」
    const cnDot = trimmed.match(/^([一二三四五六七八九十百]+)[.．]\s*(.*)$/u)
    if (cnDot) {
      const replacement = cnDot[2] ? `${cnDot[1]}、${cnDot[2]}` : `${cnDot[1]}、`
      pushSample(trimmed, replacement)
      trimmed = replacement
    }

    if (!shouldConvertArabicH1 || !looksLikeTopLevelArabicHeading(trimmed)) {
      return trimmed
    }
    if (isAttachmentContext(lines, index)) return trimmed

    const prev = previousNonEmpty(lines, index)
    const arabic = trimmed.match(/^(\d+)[、．.]\s*(.*)$/u)
    if (!arabic) return trimmed

    // 上一行是二级标题时，规范为三级「1.」
    if (/^（[一二三四五六七八九十百\d]+）/u.test(prev)) {
      const replacement = arabic[2] ? `${arabic[1]}. ${arabic[2]}` : `${arabic[1]}.`
      pushSample(trimmed, replacement)
      return replacement
    }

    const cn = toChineseOrdinal(Number(arabic[1]))
    if (!cn) return trimmed
    const replacement = arabic[2] ? `${cn}、${arabic[2]}` : `${cn}、`
    pushSample(trimmed, replacement)
    return replacement
  })

  return {
    content: next.join('\n'),
    convertedCount,
    samples,
  }
}
