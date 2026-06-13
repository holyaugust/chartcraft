function elementsByLocalName(root: Element | Document, localName: string): Element[] {
  const result: Element[] = []
  for (const node of root.getElementsByTagName('*')) {
    if ((node as Element).localName === localName) {
      result.push(node as Element)
    }
  }
  return result
}

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 从单页 slide XML 提取可见文本（按文档顺序，仅文本框） */
export function extractTextsFromSlideXml(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    return []
  }

  const texts: string[] = []
  for (const sp of findTextShapes(doc.documentElement)) {
    for (const line of readShapeLines(sp)) {
      if (line) texts.push(line)
    }
  }
  return texts
}

function getPlaceholderType(sp: Element): string | null {
  for (const node of sp.getElementsByTagName('*')) {
    if ((node as Element).localName === 'ph') {
      const ph = node as Element
      return ph.getAttribute('type') ?? ph.getAttribute('idx')
    }
  }
  return null
}

function isTitlePlaceholder(ph: string | null): boolean {
  return ph === 'title' || ph === 'ctrTitle' || ph === '0'
}

function isSubTitlePlaceholder(ph: string | null): boolean {
  return ph === 'subTitle' || ph === '1'
}

function isBodyPlaceholder(ph: string | null): boolean {
  return ph === 'body' || ph === 'obj' || ph === '2'
}

export interface SlidePlaceholderSummary {
  placeholderTypes: string[]
  shapeCount: number
  texts: string[]
}

export interface SlideTextWritePlan {
  title?: string
  subtitle?: string
  bullets?: string[]
  layout?: 'title' | 'section' | 'content' | 'closing' | 'chart'
  /** 清空未写入的文本框（去除模板示例文字） */
  clearUnused?: boolean
}

export function getSlidePlaceholderSummary(xml: string): SlidePlaceholderSummary {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    return { placeholderTypes: [], shapeCount: 0, texts: [] }
  }

  const shapes = findTextShapes(doc.documentElement)
  const placeholderTypes = shapes
    .map((sp) => getPlaceholderType(sp))
    .filter((value): value is string => Boolean(value))

  return {
    placeholderTypes,
    shapeCount: shapes.length,
    texts: extractTextsFromSlideXml(xml),
  }
}

function findTextShapes(root: Element): Element[] {
  return elementsByLocalName(root, 'sp').filter((sp) => elementsByLocalName(sp, 'txBody').length > 0)
}

function getShapePosition(sp: Element): { x: number; y: number } {
  for (const node of sp.getElementsByTagName('*')) {
    if ((node as Element).localName === 'off') {
      const off = node as Element
      return {
        x: Number.parseInt(off.getAttribute('x') ?? '0', 10),
        y: Number.parseInt(off.getAttribute('y') ?? '0', 10),
      }
    }
  }
  return { x: 0, y: 0 }
}

function getShapeArea(sp: Element): number {
  let cx = 0
  let cy = 0
  for (const node of sp.getElementsByTagName('*')) {
    const el = node as Element
    if (el.localName === 'ext') {
      cx = Number.parseInt(el.getAttribute('cx') ?? '0', 10)
      cy = Number.parseInt(el.getAttribute('cy') ?? '0', 10)
    }
  }
  return cx * cy
}

function sortShapesByPosition(shapes: Element[]): Element[] {
  return [...shapes].sort((a, b) => {
    const pa = getShapePosition(a)
    const pb = getShapePosition(b)
    if (pa.y !== pb.y) return pa.y - pb.y
    return pa.x - pb.x
  })
}

function readShapeLines(sp: Element): string[] {
  const txBody = elementsByLocalName(sp, 'txBody')[0]
  if (!txBody) return []

  const lines: string[] = []
  for (const p of elementsByLocalName(txBody, 'p')) {
    const parts: string[] = []
    for (const t of elementsByLocalName(p, 't')) {
      const value = t.textContent?.replace(/\s+/g, ' ').trim()
      if (value) parts.push(value)
    }
    const line = parts.join('').trim()
    if (line) lines.push(line)
  }
  return lines
}

function getShapeId(sp: Element): string | null {
  for (const node of sp.getElementsByTagName('*')) {
    const el = node as Element
    if (el.localName === 'cNvPr') {
      const id = el.getAttribute('id')
      if (id) return id
    }
  }
  return null
}

function findElementEnd(xml: string, openStart: number, localName: string): number {
  const openPattern = new RegExp(`<(?:p:)?${localName}\\b`, 'gi')
  const closePattern = new RegExp(`</(?:p:)?${localName}>`, 'gi')

  openPattern.lastIndex = openStart
  if (!openPattern.exec(xml)) return -1

  let depth = 1
  let cursor = openStart + 1

  while (depth > 0 && cursor < xml.length) {
    openPattern.lastIndex = cursor
    closePattern.lastIndex = cursor
    const nextOpen = openPattern.exec(xml)
    const nextClose = closePattern.exec(xml)
    if (!nextClose) return -1

    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1
      cursor = nextOpen.index + nextOpen[0].length
    } else {
      depth -= 1
      if (depth === 0) return nextClose.index + nextClose[0].length
      cursor = nextClose.index + nextClose[0].length
    }
  }

  return -1
}

/** 仅提取 shape（sp）上的 txBody，顺序与 findTextShapes 一致 */
function getTextShapeTxBodyBlocks(
  xml: string,
): Array<{ start: number; end: number; content: string; id: string | null }> {
  const blocks: Array<{ start: number; end: number; content: string; id: string | null }> = []
  const openSp = /<(?:p:)?sp\b/gi
  let match = openSp.exec(xml)

  while (match) {
    const spStart = match.index
    const spEnd = findElementEnd(xml, spStart, 'sp')
    if (spEnd > spStart) {
      const spXml = xml.slice(spStart, spEnd)
      const txBodyMatch = spXml.match(/<(?:p:)?txBody\b[\s\S]*?<\/(?:p:)?txBody>/i)
      if (txBodyMatch) {
        const txStart = spStart + spXml.indexOf(txBodyMatch[0])
        const idMatch = spXml.match(/<(?:p:)?cNvPr\b[^>]*\bid="(\d+)"/i)
        blocks.push({
          start: txStart,
          end: txStart + txBodyMatch[0].length,
          content: txBodyMatch[0],
          id: idMatch?.[1] ?? null,
        })
      }
    }
    match = openSp.exec(xml)
  }

  return blocks
}

function findTxBodyBlockByShapeId(
  xml: string,
  shapeId: string,
): { start: number; end: number; content: string } | null {
  const idNeedle = `id="${shapeId}"`
  let searchFrom = 0

  while (searchFrom < xml.length) {
    const idIdx = xml.indexOf(idNeedle, searchFrom)
    if (idIdx < 0) return null

    const spStart = Math.max(xml.lastIndexOf('<p:sp', idIdx), xml.lastIndexOf('<sp', idIdx))
    if (spStart < 0) {
      searchFrom = idIdx + 1
      continue
    }

    const spEnd = findElementEnd(xml, spStart, 'sp')
    if (spEnd < 0) {
      searchFrom = idIdx + 1
      continue
    }

    const spXml = xml.slice(spStart, spEnd)
    if (!spXml.includes(idNeedle)) {
      searchFrom = idIdx + 1
      continue
    }

    const txBodyMatch = spXml.match(/<(?:p:)?txBody\b[\s\S]*?<\/(?:p:)?txBody>/i)
    if (txBodyMatch) {
      const txStart = spStart + spXml.indexOf(txBodyMatch[0])
      return {
        start: txStart,
        end: txStart + txBodyMatch[0].length,
        content: txBodyMatch[0],
      }
    }

    searchFrom = idIdx + 1
  }

  return null
}

function replaceParagraphText(pXml: string, text: string): string {
  const escaped = escapeXmlText(text)
  const openMatch = pXml.match(/<a:p\b[^>]*>/i)
  if (!openMatch) return pXml

  const pPrMatch = pXml.match(/<a:pPr\b[\s\S]*?<\/a:pPr>/i)
  const pPr = pPrMatch?.[0] ?? ''
  return `${openMatch[0]}${pPr}<a:r><a:t xml:space="preserve">${escaped}</a:t></a:r></a:p>`
}

function rebuildTxBodyXml(originalTxBodyXml: string, lines: string[]): string {
  const closeTag = /<\/p:txBody>/i.test(originalTxBodyXml) ? '</p:txBody>' : '</txBody>'
  const paragraphMatches = [...originalTxBodyXml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/gi)]
  const templateP = paragraphMatches[0]?.[0]
  const firstParagraphIndex = originalTxBodyXml.search(/<a:p\b/i)
  const prefix =
    firstParagraphIndex > 0 ? originalTxBodyXml.slice(0, firstParagraphIndex) : originalTxBodyXml.replace(/<a:p[\s\S]*$/i, '')

  const normalized = lines
    .map((line) => String(line ?? '').trim())
    .filter(Boolean)

  if (normalized.length === 0) {
    const emptyParagraph = templateP
      ? replaceParagraphText(templateP, '')
      : '<a:p><a:r><a:t xml:space="preserve"></a:t></a:r></a:p>'
    return `${prefix}${emptyParagraph}${closeTag}`
  }

  const paragraphs = normalized
    .map((line) =>
      templateP
        ? replaceParagraphText(templateP, line)
        : `<a:p><a:r><a:t xml:space="preserve">${escapeXmlText(line)}</a:t></a:r></a:p>`,
    )
    .join('')

  return `${prefix}${paragraphs}${closeTag}`
}

function pickPrimaryContentShape(contentShapes: Element[]): Element {
  const sorted = sortShapesByPosition(contentShapes)
  if (sorted.length >= 3) {
    const rest = sorted.slice(1)
    return [...rest].sort((a, b) => getShapeArea(b) - getShapeArea(a))[0]
  }
  return [...sorted].sort((a, b) => getShapeArea(b) - getShapeArea(a))[0]
}

function findShapeIndexByPlaceholder(shapes: Element[], matcher: (ph: string | null) => boolean): number {
  return shapes.findIndex((sp) => matcher(getPlaceholderType(sp)))
}

function findBodyShapeIndex(shapes: Element[], reserved: Set<number>): number {
  const bodyIndex = shapes.findIndex(
    (sp, index) => !reserved.has(index) && isBodyPlaceholder(getPlaceholderType(sp)),
  )
  if (bodyIndex >= 0) return bodyIndex

  const candidates = shapes
    .map((sp, index) => ({ sp, index }))
    .filter(({ index }) => !reserved.has(index))
  if (candidates.length === 0) return -1

  const primary = pickPrimaryContentShape(candidates.map((entry) => entry.sp))
  const match = candidates.find((entry) => entry.sp === primary)
  return match?.index ?? candidates[0].index
}

/** 为每个文本框规划要写入的内容（按 DOM 中文本框顺序） */
function planShapeLines(shapes: Element[], plan: SlideTextWritePlan): string[][] {
  const planned: string[][] = shapes.map(() => [])
  const safeTitle = String(plan.title ?? '').trim()
  const safeSubtitle = String(plan.subtitle ?? '').trim()
  const bodyLines = (plan.bullets ?? []).map((line) => String(line ?? '').trim()).filter(Boolean)
  const clearUnused = plan.clearUnused ?? false
  const layout = plan.layout ?? 'content'

  const titleIndex = findShapeIndexByPlaceholder(shapes, isTitlePlaceholder)
  const subtitleIndex = findShapeIndexByPlaceholder(shapes, isSubTitlePlaceholder)
  const reserved = new Set<number>()
  if (titleIndex >= 0) reserved.add(titleIndex)
  if (subtitleIndex >= 0) reserved.add(subtitleIndex)

  if (titleIndex >= 0 && safeTitle) {
    planned[titleIndex] = [safeTitle]
  } else if (titleIndex < 0 && safeTitle && shapes.length > 0) {
    planned[0] = [safeTitle]
    reserved.add(0)
  }

  if (subtitleIndex >= 0 && safeSubtitle) {
    planned[subtitleIndex] = [safeSubtitle]
  } else if (layout === 'title' && safeSubtitle && subtitleIndex < 0) {
    const bodyIndex = findBodyShapeIndex(shapes, reserved)
    if (bodyIndex >= 0) {
      planned[bodyIndex] = [safeSubtitle]
      reserved.add(bodyIndex)
    }
  }

  if (bodyLines.length > 0) {
    const bodyIndex = findBodyShapeIndex(shapes, reserved)
    if (bodyIndex >= 0) {
      planned[bodyIndex] = bodyLines
      reserved.add(bodyIndex)
    } else if (titleIndex >= 0) {
      planned[titleIndex] = [...(planned[titleIndex] ?? []), ...bodyLines]
    } else if (shapes.length > 0) {
      planned[0] = [...(planned[0] ?? []), ...bodyLines]
    }
  }

  if (clearUnused) {
    for (let i = 0; i < planned.length; i += 1) {
      if (planned[i].length === 0) {
        planned[i] = ['']
      }
    }
  }

  return planned
}

function patchTxBodiesInXml(
  xml: string,
  shapes: Element[],
  planned: string[][],
  clearUnused: boolean,
): string {
  const spBlocks = getTextShapeTxBodyBlocks(xml)
  if (spBlocks.length === 0) return xml

  const patches: Array<{ start: number; end: number; newContent: string }> = []

  for (let i = 0; i < shapes.length; i += 1) {
    const rawLines = planned[i] ?? []
    const hasExplicitEmpty = clearUnused && rawLines.length === 1 && rawLines[0] === ''
    const lines = rawLines
      .map((line) => String(line ?? '').trim())
      .filter((line) => line.length > 0)
    if (lines.length === 0 && !hasExplicitEmpty) continue

    const shapeId = getShapeId(shapes[i])
    const block =
      (shapeId ? findTxBodyBlockByShapeId(xml, shapeId) : null) ??
      (i < spBlocks.length ? spBlocks[i] : null)
    if (!block) continue

    patches.push({
      start: block.start,
      end: block.end,
      newContent: rebuildTxBodyXml(block.content, hasExplicitEmpty ? [''] : lines),
    })
  }

  if (patches.length === 0) return xml

  patches.sort((a, b) => b.start - a.start)
  let patched = xml
  for (const patch of patches) {
    patched = patched.slice(0, patch.start) + patch.newContent + patched.slice(patch.end)
  }

  return patched
}

/**
 * 将标题与要点写回 slide 的文本框（保留原 XML 结构，不修改图表内文字）
 */
export function applyTextsToSlideXml(
  xml: string,
  title: string | undefined,
  bullets: string[] | undefined = [],
  options?: Omit<SlideTextWritePlan, 'title' | 'bullets'>,
): string {
  return applySlideTextPlanToXml(xml, {
    title,
    bullets,
    ...options,
  })
}

export function applySlideTextPlanToXml(xml: string, plan: SlideTextWritePlan): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    return xml
  }

  const shapes = findTextShapes(doc.documentElement)
  if (shapes.length === 0) return xml

  const clearUnused =
    plan.clearUnused ??
    (plan.layout === 'section' || plan.layout === 'closing' || plan.layout === 'title')
  const planned = planShapeLines(shapes, { ...plan, clearUnused })
  const hasContent = planned.some((lines) => lines.length > 0)
  if (!hasContent) return xml

  return patchTxBodiesInXml(xml, shapes, planned, clearUnused)
}

export function combineSlideTexts(slides: { texts: string[] }[]): string {
  return slides
    .map((slide, index) => {
      const body = slide.texts.join('\n').trim()
      return body ? `【第 ${index + 1} 页】\n${body}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
}
