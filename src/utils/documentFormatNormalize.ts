/**
 * 公文结构规范化：层次标题与正文拆行、附件格式拆行
 */

export function stripLeadingIndent(text: string): string {
  return text.replace(/^[ \t　]+/, '')
}

export function expandAttachmentLine(line: string): string[] {
  const trimmed = stripLeadingIndent(line.trim())
  const inlineMatch = trimmed.match(/^附件([：:])(?:\s*)(\S.+)$/u)
  if (!inlineMatch) return [trimmed || line]
  return [`附件${inlineMatch[1]}`, inlineMatch[2].trim()]
}

function trySplitHeadingBody(trimmed: string, prefixRe: RegExp): string[] | null {
  const match = trimmed.match(prefixRe)
  if (!match) return null

  const prefixLen = match[0].length
  const afterPrefix = trimmed.slice(prefixLen)
  const punctIdx = afterPrefix.search(/[。：；]/)
  if (punctIdx < 0) return null

  const bodyPart = afterPrefix.slice(punctIdx + 1).trim()
  if (bodyPart.length < 6) return null

  return [trimmed.slice(0, prefixLen + punctIdx + 1), bodyPart]
}

/** 将「（一）标题。正文…」等同段混排拆成两行 */
export function splitInlineHeadingBodyLine(line: string): string[] {
  const trimmed = stripLeadingIndent(line.trim())
  if (!trimmed) return [line]

  const patterns = [
    /^[一二三四五六七八九十百零〇]+[、．.](?!(\d|．|\.))/u,
    /^（[一二三四五六七八九十百零〇]+）/u,
    /^（\d+）/u,
    /^\d+[．.、]\s/u,
  ]

  for (const re of patterns) {
    const split = trySplitHeadingBody(trimmed, re)
    if (split) return split
  }

  return [trimmed]
}

export function normalizeDocumentLine(line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed) return [line]

  if (/^附件[：:]/u.test(stripLeadingIndent(trimmed))) {
    return expandAttachmentLine(line)
  }

  const headingSplit = splitInlineHeadingBodyLine(line)
  if (headingSplit.length > 1) return headingSplit

  return [trimmed]
}

/** 规范化全文：逐行拆分混排的层次标题/正文与附件，并补齐仅有标题无正文的层次 */
export function normalizeDocumentStructure(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out: string[] = []

  for (const line of lines) {
    if (!line.trim()) {
      out.push(line)
      continue
    }
    for (const part of normalizeDocumentLine(line)) {
      out.push(part)
    }
  }

  return ensureHeadingBodyStructure(normalizeSignatureBlock(out.join('\n')))
}

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4'

function detectHeadingLevel(trimmed: string): HeadingLevel | null {
  if (/^[一二三四五六七八九十百零〇]+[、．.](?!(\d|．|\.))/u.test(trimmed)) return 'h1'
  if (/^（[一二三四五六七八九十百零〇]+）/u.test(trimmed)) return 'h2'
  if (/^（\d+）/u.test(trimmed)) return 'h4'
  if (/^\d+[．.、]\s/u.test(trimmed) && trimmed.length <= 48 && !/[。；！？]/.test(trimmed)) return 'h3'
  return null
}

function isStructuralLine(trimmed: string): boolean {
  if (!trimmed) return true
  if (trimmed.startsWith('【')) return true
  if (/^附件[：:]/u.test(trimmed)) return true
  if (/^表\d+/u.test(trimmed)) return true
  if (/^单位[：:]/u.test(trimmed)) return true
  if (/^序号\s*[|｜]/u.test(trimmed)) return true
  if (/^任务\s*[|｜]/u.test(trimmed)) return true
  if (detectHeadingLevel(trimmed)) return true
  if (/^\d+[．.、]\s/u.test(trimmed)) return true
  if (/^[ 　]+\d+[．.]/.test(trimmed)) return true
  if (/^抄送[：:]|^分送[：:]/u.test(trimmed)) return true
  if (/^（此件/u.test(trimmed)) return true
  if (isSignatureOrgLine(trimmed) || isSignatureDateLine(trimmed)) return true
  return false
}

const HEADING_BODY_PLACEHOLDER = '（请在此补充具体内容。）'

const SECTION_FOUR_INTRO =
  '结合工作推进需求，列明需集团审议、审批、协调、指导、支持的具体事项：'

function needsBodyAfterHeading(level: HeadingLevel, nextLevel: HeadingLevel | null, nextTrimmed: string): boolean {
  if (!nextLevel) return true
  if (level === 'h1' && nextLevel === 'h2') return false
  if (level === 'h1' && nextLevel === 'h3') return false
  if (level === 'h2' && nextLevel === 'h3') return false
  if (level === 'h2' && nextLevel === 'h4') return false
  if (level === 'h1' && /^\d+[．.、]\s/.test(nextTrimmed)) return true
  return true
}

function bodyPlaceholderForHeading(trimmed: string, level: HeadingLevel, nextTrimmed: string): string {
  if (level === 'h1' && /需上级审议|需集团|需协调|审议及支持/u.test(trimmed) && /^\d+[．.、]\s/.test(nextTrimmed)) {
    return SECTION_FOUR_INTRO
  }
  return HEADING_BODY_PLACEHOLDER
}

/** 层次标题下若无正文，自动插入占位说明行 */
export function ensureHeadingBodyStructure(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim()
    out.push(trimmed || lines[i])

    if (!trimmed || /（请在此补充/.test(trimmed)) continue

    const level = detectHeadingLevel(trimmed)
    if (!level) continue

    let j = i + 1
    while (j < lines.length && !lines[j].trim()) j += 1

    if (j >= lines.length) {
      out.push(bodyPlaceholderForHeading(trimmed, level, ''))
      continue
    }

    const nextTrimmed = lines[j].trim()
    if (!isStructuralLine(nextTrimmed)) continue
    if (/^表\d+/u.test(nextTrimmed) || /^单位[：:]/u.test(nextTrimmed)) continue

    const nextLevel = detectHeadingLevel(nextTrimmed)
    if (!needsBodyAfterHeading(level, nextLevel, nextTrimmed)) continue

    out.push(bodyPlaceholderForHeading(trimmed, level, nextTrimmed))
  }

  return out.join('\n')
}

const SIGNATURE_ORG_SUFFIX =
  /(?:有限公司|有限责任公司|集团有限公司|股份有限公司|委员会|指挥部|中心|办公室|集团)$/u

const SIGNATURE_DATE_RE = /^[\dX×]{4}年[\dX×]{1,2}月[\dX×]{1,2}日(印发)?$/u

const SIGNATURE_ORG_INLINE_RE =
  /^(.+?(?:有限公司|有限责任公司|集团有限公司|股份有限公司|委员会|指挥部|中心|办公室|集团))\s*([\dX×]{4}年[\dX×]{1,2}月[\dX×]{1,2}日)(印发)?$/u

export function isSignatureOrgLine(trimmed: string): boolean {
  const text = stripLeadingIndent(trimmed)
  if (!text || text.startsWith('【') || /[：:].+[：:]/.test(text)) return false
  if (/^(抄送|分送|附件|主送|报送|编制)/u.test(text)) return false
  if (text.length > 36) return false
  return SIGNATURE_ORG_SUFFIX.test(text)
}

export function isSignatureDateLine(trimmed: string): boolean {
  return SIGNATURE_DATE_RE.test(stripLeadingIndent(trimmed))
}

function ensureBlankLineBefore(lines: string[]): void {
  if (lines.length === 0) return
  if (lines[lines.length - 1].trim() === '') return
  lines.push('')
}

function splitInlineSignatureLine(line: string): string[] | null {
  const trimmed = stripLeadingIndent(line.trim())
  const match = trimmed.match(SIGNATURE_ORG_INLINE_RE)
  if (!match) return null
  const date = match[3] ? `${match[2]}印发` : match[2]
  return [match[1], date]
}

function extractAttachmentBlock(lines: string[]): { attachments: string[]; rest: string[] } {
  const start = lines.findIndex((line) => /^附件[：:]/u.test(stripLeadingIndent(line.trim())))
  if (start < 0) return { attachments: [], rest: lines }

  let end = start + 1
  while (end < lines.length) {
    const trimmed = lines[end].trim()
    if (!trimmed) {
      end += 1
      continue
    }
    if (isSignatureOrgLine(trimmed) || isSignatureDateLine(trimmed) || /^（此件/u.test(trimmed)) break
    if (/^抄送[：:]|^分送[：:]/u.test(trimmed)) break
    end += 1
  }

  return {
    attachments: lines.slice(start, end),
    rest: [...lines.slice(0, start), ...lines.slice(end)],
  }
}

function extractSignatureBlock(lines: string[]): { signature: string[]; rest: string[] } {
  let i = lines.length - 1

  while (i >= 0 && !lines[i].trim()) i -= 1
  if (i < 0) return { signature: [], rest: lines }

  const tail: string[] = []
  while (i >= 0) {
    const trimmed = lines[i].trim()
    if (!trimmed) break

    if (isSignatureDateLine(trimmed)) {
      tail.unshift(stripLeadingIndent(trimmed))
      i -= 1
      continue
    }

    const inline = splitInlineSignatureLine(lines[i])
    if (inline) {
      tail.unshift(...inline)
      i -= 1
      continue
    }

    if (isSignatureOrgLine(trimmed)) {
      tail.unshift(stripLeadingIndent(trimmed))
      i -= 1
      continue
    }

    break
  }

  if (tail.length === 0) return { signature: [], rest: lines }

  const rest = lines.slice(0, i + 1)
  while (rest.length > 0 && !rest[rest.length - 1].trim()) rest.pop()

  return { signature: tail, rest }
}

/** 规范国企公文落款：拆行、空行、附件在落款前，保留抄送/印发等尾部说明 */
export function normalizeSignatureBlock(text: string): string {
  const lines = text.split('\n').map((line) => {
    const inline = splitInlineSignatureLine(line)
    if (inline) return inline
    const trimmed = line.trim()
    return [trimmed ? stripLeadingIndent(trimmed) : line]
  }).flat()

  const footer: string[] = []
  let end = lines.length - 1
  while (end >= 0) {
    const trimmed = lines[end].trim()
    if (!trimmed) {
      end -= 1
      continue
    }
    if (
      /^（此件/u.test(trimmed) ||
      /^抄送[：:]|^分送[：:]/u.test(trimmed) ||
      /印发$/.test(trimmed)
    ) {
      footer.unshift(stripLeadingIndent(trimmed))
      end -= 1
      continue
    }
    break
  }

  const middle = lines.slice(0, end + 1)
  const { attachments, rest: withoutAttachment } = extractAttachmentBlock(middle)
  const { signature, rest } = extractSignatureBlock(withoutAttachment)

  if (signature.length === 0 && attachments.length === 0) return text

  const body: string[] = [...rest]

  if (attachments.length > 0) {
    ensureBlankLineBefore(body)
    for (const line of attachments) {
      const trimmed = stripLeadingIndent(line.trim())
      if (!trimmed) continue
      if (/^附件[：:]/u.test(trimmed)) {
        for (const part of expandAttachmentLine(trimmed)) body.push(part)
      } else {
        body.push(trimmed)
      }
    }
  }

  if (signature.length > 0) {
    ensureBlankLineBefore(body)
    for (const line of signature) body.push(line)
  }

  if (footer.length > 0) {
    ensureBlankLineBefore(body)
    for (const line of footer) body.push(line)
  }

  return body.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
}

/** 编辑器 CSS 预览：是否与 Word 导出一致显示首行缩进 2 字符（不改变纯文本内容） */
export function lineNeedsEditorFirstLineIndent(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false

  if (/^【/.test(trimmed)) return false
  if (/^附件[：:]/u.test(trimmed)) return false
  if (/^抄送[：:]|^分送[：:]/u.test(trimmed)) return false
  if (/^表\d+/u.test(trimmed)) return false
  if (/^单位[：:]/u.test(trimmed)) return false

  if (/^[一二三四五六七八九十百零〇]+[、．.](?!(\d|．|\.))/u.test(trimmed)) return false
  if (/^（[一二三四五六七八九十百零〇]+）/u.test(trimmed)) return false
  if (/^（\d+）/.test(trimmed)) return false

  if (/^\d+[．.、]\s/u.test(trimmed)) {
    if (trimmed.length <= 48 && !/[；。！？]/.test(trimmed)) return false
    return false
  }

  if (/：\s*$/u.test(trimmed) && trimmed.length <= 40) return false

  if (isSignatureOrgLine(trimmed) || isSignatureDateLine(trimmed)) return false

  if (
    /(有限公司|集团)关于.*的(报告|请示)/u.test(trimmed) &&
    trimmed.length <= 80
  ) {
    return false
  }

  if (
    /^关于.*的(请示|报告|通知|通报|意见|函|决定|批复|议案|方案|说明|命令|公告|通告|公报|纪要)/u.test(
      trimmed,
    ) &&
    trimmed.length <= 80
  ) {
    return false
  }

  if (/^.+会议纪要$/u.test(trimmed) && trimmed.length <= 40) return false

  return true
}
