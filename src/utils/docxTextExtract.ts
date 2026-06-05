import JSZip from 'jszip'

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

/** 表格列分隔符（可见；导出 Excel 时可按此分列） */
export const TABLE_COL_SEP = ' | '

const DOCX_TEXT_PARTS = /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i

/** 按 XML 文档顺序拼接文本；表格保留为「列分隔 / 行换行」结构 */
export async function extractTextFromDocxXml(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const partPaths = Object.keys(zip.files)
    .filter((name) => DOCX_TEXT_PARTS.test(name))
    .sort()

  const sections: string[] = []

  for (const path of partPaths) {
    const file = zip.file(path)
    if (!file) continue
    const xml = await file.async('string')
    const sectionText = extractTextFromDocumentXml(xml)
    if (sectionText.trim()) sections.push(sectionText)
  }

  return cleanWordArtifactSpaces(
    sections.join('\n\n').replace(/\n{3,}/g, '\n\n').trim(),
  )
}

/** 从 document.xml 提取正文块列表（不含页眉页脚） */
export function extractBodyBlocksFromDocumentXml(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return []
  }

  const body = findWordBody(doc)
  if (!body) return []

  return extractBlockList(body)
}

function getWordLocalName(element: Element): string | null {
  if (element.namespaceURI === WORD_NS) return element.localName
  if (element.prefix === 'w') return element.localName
  if (element.tagName.startsWith('w:')) return element.tagName.slice(2)
  return null
}

function isWordElement(element: Element, localName: string): boolean {
  return getWordLocalName(element) === localName
}

function findWordBody(doc: Document): Element | null {
  const byNs = doc.getElementsByTagNameNS(WORD_NS, 'body')
  if (byNs.length > 0) return byNs[0]

  for (const node of doc.getElementsByTagName('*')) {
    const element = node as Element
    if (getWordLocalName(element) === 'body') return element
  }

  return null
}

function findWordDescendants(root: Element, localName: string): Element[] {
  const result: Element[] = []
  if (getWordLocalName(root) === localName) result.push(root)

  for (const node of root.getElementsByTagName('*')) {
    const element = node as Element
    if (getWordLocalName(element) === localName) result.push(element)
  }

  return result
}

function extractTextFromDocumentXml(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return ''
  }

  const body = findWordBody(doc)
  if (!body) return ''

  let text = extractBlockSequence(body)

  // 兜底：表格可能在文本框等深层容器内，按文档顺序补提取
  if (!text.includes(TABLE_COL_SEP)) {
    const tables = findWordDescendants(body, 'tbl')
    const tableTexts = tables.map(extractTableText).filter((t) => t.trim())
    if (tableTexts.length > 0) {
      const merged = tableTexts.join('\n\n')
      text = text ? `${text}\n\n${merged}` : merged
    }
  }

  return text
}

/** 按文档顺序提取段落与表格块（与纯文本导出格式一致） */
export function extractBlockList(container: Element): string[] {
  const blocks: string[] = []

  for (const child of container.childNodes) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const element = child as Element
    const localName = getWordLocalName(element)
    if (!localName) continue

    switch (localName) {
      case 'p': {
        const text = collectParagraphText(element)
        if (text.trim()) blocks.push(text)
        break
      }
      case 'tbl': {
        const tableText = extractTableText(element)
        if (tableText.trim()) blocks.push(tableText)
        break
      }
      case 'sdt': {
        const content = findWordDescendants(element, 'sdtContent')[0]
        if (content) {
          const nested = extractBlockList(content)
          if (nested.length > 0) blocks.push(nested.join('\n'))
        }
        break
      }
      case 'customXml':
      case 'ins':
      case 'smartTag':
      case 'txbxContent': {
        const nested = extractBlockList(element)
        if (nested.length > 0) blocks.push(nested.join('\n'))
        break
      }
      default:
        break
    }
  }

  return blocks
}

/** 按文档顺序提取段落与表格块 */
function extractBlockSequence(container: Element): string {
  return extractBlockList(container).join('\n')
}

export function extractTableText(table: Element): string {
  const rows = getDirectWordChildren(table, 'tr')
  const rowTexts: string[] = []

  for (const row of rows) {
    const cells = getDirectWordChildren(row, 'tc')
    const columnTexts: string[] = []

    for (const cell of cells) {
      if (isVerticalMergeContinue(cell)) {
        const span = getGridSpan(cell)
        for (let i = 0; i < span; i += 1) columnTexts.push('')
        continue
      }

      columnTexts.push(extractCellText(cell))
      const span = getGridSpan(cell)
      for (let i = 1; i < span; i += 1) {
        columnTexts.push('')
      }
    }

    if (columnTexts.some((cell) => cell.trim().length > 0)) {
      rowTexts.push(columnTexts.join(TABLE_COL_SEP))
    }
  }

  return rowTexts.join('\n')
}

function extractCellText(cell: Element): string {
  const parts: string[] = []

  for (const child of cell.childNodes) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const element = child as Element
    const localName = getWordLocalName(element)
    if (!localName) continue

    if (localName === 'p') {
      const text = collectParagraphText(element)
      if (text.trim()) parts.push(text)
    } else if (localName === 'tbl') {
      const nested = extractTableText(element)
      if (nested.trim()) parts.push(`[${nested.replace(/\n/g, ' / ')}]`)
    } else if (localName === 'sdt') {
      const content = findWordDescendants(element, 'sdtContent')[0]
      if (content) {
        const nested = extractBlockSequence(content)
        if (nested.trim()) parts.push(nested.replace(/\n/g, ' '))
      }
    }
  }

  return cleanWordArtifactSpaces(parts.join(' ').replace(/\s+/g, ' ')).trim()
}

function collectParagraphText(paragraph: Element): string {
  const raw = collectTextFromNode(paragraph).replace(/\s+/g, ' ')
  return cleanWordArtifactSpaces(raw).trim()
}

function collectTextFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const element = node as Element
  const localName = getWordLocalName(element)

  if (localName) {
    switch (localName) {
      case 't':
        return element.textContent ?? ''
      case 'tab':
        return '\t'
      case 'br':
      case 'cr':
        return '\n'
      case 'del':
      case 'moveFrom':
      case 'instrText':
        return ''
      default:
        break
    }
  }

  let text = ''
  for (const child of element.childNodes) {
    text += collectTextFromNode(child)
  }
  return text
}

function getDirectWordChildren(parent: Element, localName: string): Element[] {
  const result: Element[] = []
  for (const child of parent.childNodes) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const element = child as Element
    if (isWordElement(element, localName)) {
      result.push(element)
    }
  }
  return result
}

function getGridSpan(cell: Element): number {
  const tcPr = getDirectWordChildren(cell, 'tcPr')[0]
  if (!tcPr) return 1

  for (const child of tcPr.childNodes) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const element = child as Element
    if (!isWordElement(element, 'gridSpan')) continue
    const val = element.getAttributeNS(WORD_NS, 'val') ?? element.getAttribute('w:val') ?? '1'
    const parsed = Number.parseInt(val, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  }

  return 1
}

function isVerticalMergeContinue(cell: Element): boolean {
  const tcPr = getDirectWordChildren(cell, 'tcPr')[0]
  if (!tcPr) return false

  for (const child of tcPr.childNodes) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const element = child as Element
    if (!isWordElement(element, 'vMerge')) continue
    const val = element.getAttributeNS(WORD_NS, 'val') ?? element.getAttribute('w:val')
    return val !== 'restart'
  }

  return false
}

/** 归一化后比较两段文本是否大致一致（用于检测预览漏字） */
export function normalizeDocxPlainText(text: string): string {
  return text.replace(/\s+/g, '')
}

/**
 * Word 按 run 分片存储时，常在汉字与数字/符号之间带入多余空格。
 * 导入纯文本后清理，避免后续校对误报。
 */
export function cleanWordArtifactSpaces(text: string): string {
  return text
    .replace(/([\u4e00-\u9fff])[ \u00a0\u3000\t]+(?=[0-9０-９%％°℃·×/\.．,\-—])/gu, '$1')
    .replace(/(?<=[0-9０-９%％°℃])[ \u00a0\u3000\t]+([\u4e00-\u9fff])/gu, '$1')
    .replace(/(\d)[ \u00a0\u3000]+(%[％]?)/g, '$1$2')
    .replace(/([%％])[ \u00a0\u3000]+([\u4e00-\u9fff])/g, '$1$2')
}

export function countCjkChars(text: string): number {
  const matches = text.match(/[\u4e00-\u9fff]/g)
  return matches?.length ?? 0
}

/** 文本中是否包含表格行（含列分隔符的多列） */
export function hasTableLikeRows(text: string): boolean {
  return text.split('\n').some((line) => line.includes(TABLE_COL_SEP))
}
