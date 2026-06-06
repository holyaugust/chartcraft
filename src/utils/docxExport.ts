import JSZip from 'jszip'
import {
  TABLE_COL_SEP,
  extractBodyBlocksFromDocumentXml,
  extractTableText,
  extractTextFromDocxXml,
} from './docxTextExtract'
import { createFormattedDocxFromPlainText } from './docxFormattedExport'

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

export interface DocxExportResult {
  buffer: ArrayBuffer
  warnings: string[]
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

function collectParagraphText(paragraph: Element): string {
  return collectTextFromNode(paragraph).replace(/\s+/g, ' ').trim()
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

function setTextNodeContent(textNode: Element, text: string): void {
  textNode.textContent = text
  if (/^\s|\s$|\s{2,}/.test(text)) {
    textNode.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'space', 'preserve')
  } else {
    textNode.removeAttributeNS('http://www.w3.org/XML/1998/namespace', 'space')
  }
}

function findOrCreateTextNode(paragraph: Element): Element {
  const existing = findWordDescendants(paragraph, 't')
  if (existing.length > 0) return existing[0]

  const doc = paragraph.ownerDocument
  if (!doc) throw new Error('Word 段落缺少文档上下文')

  const run = doc.createElementNS(WORD_NS, 'w:r')
  const textNode = doc.createElementNS(WORD_NS, 'w:t')
  run.appendChild(textNode)
  paragraph.appendChild(run)
  return textNode
}

function setParagraphText(paragraph: Element, text: string): void {
  const textNodes = findWordDescendants(paragraph, 't')
  if (textNodes.length === 0) {
    setTextNodeContent(findOrCreateTextNode(paragraph), text)
    return
  }

  setTextNodeContent(textNodes[0], text)
  for (let i = 1; i < textNodes.length; i += 1) {
    setTextNodeContent(textNodes[i], '')
  }
}

function setCellText(cell: Element, text: string): void {
  const paragraphs = findWordDescendants(cell, 'p')
  if (paragraphs.length === 0) {
    const doc = cell.ownerDocument
    if (!doc) return
    const paragraph = doc.createElementNS(WORD_NS, 'w:p')
    cell.appendChild(paragraph)
    setParagraphText(paragraph, text)
    return
  }

  setParagraphText(paragraphs[0], text)
  for (let i = 1; i < paragraphs.length; i += 1) {
    setParagraphText(paragraphs[i], '')
  }
}

function setTableText(table: Element, blockText: string): void {
  const rowLines = blockText.split('\n').filter((line) => line.trim())
  const rows = getDirectWordChildren(table, 'tr')

  let lineIndex = 0
  for (const row of rows) {
    if (lineIndex >= rowLines.length) break

    const line = rowLines[lineIndex]
    if (!line.includes(TABLE_COL_SEP)) {
      lineIndex += 1
      continue
    }

    const cellTexts = line.split(TABLE_COL_SEP)
    const cells = getDirectWordChildren(row, 'tc')
    let cellTextIndex = 0

    for (const cell of cells) {
      if (isVerticalMergeContinue(cell)) {
        const span = getGridSpan(cell)
        cellTextIndex += span
        continue
      }

      const nextText = cellTexts[cellTextIndex] ?? ''
      setCellText(cell, nextText.trim())
      cellTextIndex += getGridSpan(cell)
    }

    lineIndex += 1
  }
}

interface BlockWriter {
  apply(blockText: string): void
}

function collectBlockWriters(container: Element): BlockWriter[] {
  const writers: BlockWriter[] = []

  for (const child of container.childNodes) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const element = child as Element
    const localName = getWordLocalName(element)
    if (!localName) continue

    switch (localName) {
      case 'p': {
        if (!collectParagraphText(element).trim()) break
        writers.push({
          apply: (blockText) => setParagraphText(element, blockText.replace(/\n/g, ' ').trim()),
        })
        break
      }
      case 'tbl': {
        const tableText = extractTableText(element)
        if (!tableText.trim()) break
        writers.push({
          apply: (blockText) => setTableText(element, blockText),
        })
        break
      }
      case 'sdt': {
        const content = findWordDescendants(element, 'sdtContent')[0]
        if (!content) break
        const nested = collectBlockWriters(content)
        if (nested.length === 0) break
        writers.push(createContainerWriter(nested))
        break
      }
      case 'customXml':
      case 'ins':
      case 'smartTag':
      case 'txbxContent': {
        const nested = collectBlockWriters(element)
        if (nested.length === 0) break
        writers.push(createContainerWriter(nested))
        break
      }
      default:
        break
    }
  }

  return writers
}

function createContainerWriter(nested: BlockWriter[]): BlockWriter {
  return {
    apply: (blockText) => {
      const nestedBlocks = parseEditedTextToBlocks(blockText)
      applyBlocksToWriters(nested, nestedBlocks)
    },
  }
}

function applyBlocksToWriters(writers: BlockWriter[], blocks: string[]): void {
  const count = Math.min(writers.length, blocks.length)
  for (let i = 0; i < count; i += 1) {
    writers[i].apply(blocks[i])
  }
}

/** 将编辑后的纯文本解析为与 XML 提取一致的块列表 */
export function parseEditedTextToBlocks(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i += 1
      continue
    }

    if (line.includes(TABLE_COL_SEP)) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes(TABLE_COL_SEP)) {
        tableLines.push(lines[i])
        i += 1
      }
      blocks.push(tableLines.join('\n'))
    } else {
      blocks.push(line)
      i += 1
    }
  }

  return blocks
}

function serializeDocumentXml(doc: Document, originalXml: string): string {
  const serialized = new XMLSerializer().serializeToString(doc)
  const declaration = originalXml.match(/^<\?xml[^?]*\?>/)?.[0]
  if (declaration && !serialized.startsWith('<?xml')) {
    return `${declaration}${serialized}`
  }
  return serialized
}

function deriveBodyEditedBlocks(
  editedText: string,
  originalFullText: string,
  bodyBlockCount: number,
): { blocks: string[]; warnings: string[] } {
  const warnings: string[] = []
  const allBlocks = parseEditedTextToBlocks(editedText)

  if (!originalFullText.trim()) {
    return { blocks: allBlocks.slice(0, bodyBlockCount), warnings }
  }

  const originalBlocks = parseEditedTextToBlocks(originalFullText)
  if (originalBlocks.length === bodyBlockCount) {
    return { blocks: allBlocks.slice(0, bodyBlockCount), warnings }
  }

  if (allBlocks.length === bodyBlockCount) {
    return { blocks: allBlocks, warnings }
  }

  if (allBlocks.length > bodyBlockCount) {
    warnings.push('正文块数多于 Word 原文结构，超出部分不会写入 document.xml')
    return { blocks: allBlocks.slice(0, bodyBlockCount), warnings }
  }

  warnings.push('编辑后块数少于 Word 原文，未匹配块将保留原 Word 内容')
  return { blocks: allBlocks, warnings }
}

/** 在原 docx 上写回编辑后的文本，尽量保留版式 */
export async function exportDocxFromBuffer(
  originalBuffer: ArrayBuffer,
  editedText: string,
  options?: { originalFullText?: string },
): Promise<DocxExportResult> {
  const zip = await JSZip.loadAsync(originalBuffer)
  const documentPath = 'word/document.xml'
  const documentFile = zip.file(documentPath)

  if (!documentFile) {
    throw new Error('无效的 Word 文件：缺少 word/document.xml')
  }

  const originalXml = await documentFile.async('string')
  const doc = new DOMParser().parseFromString(originalXml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Word 文档 XML 解析失败')
  }

  const body = findWordBody(doc)
  if (!body) {
    throw new Error('Word 文档缺少正文 body')
  }

  const writers = collectBlockWriters(body)
  const bodyBlockCount = writers.length
  const { blocks, warnings: deriveWarnings } = deriveBodyEditedBlocks(
    editedText,
    options?.originalFullText ?? '',
    bodyBlockCount,
  )

  const warnings = [...deriveWarnings]

  if (bodyBlockCount === 0) {
    throw new Error('Word 正文没有可写回的文本块')
  }

  if (blocks.length !== bodyBlockCount) {
    warnings.push(`正文块 ${blocks.length} 个，Word 结构 ${bodyBlockCount} 个，已按顺序尽可能写回`)
  }

  applyBlocksToWriters(writers, blocks)

  const updatedXml = serializeDocumentXml(doc, originalXml)
  zip.file(documentPath, updatedXml)

  const buffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return { buffer, warnings }
}

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildParagraphXml(text: string): string {
  const safe = escapeXmlText(text)
  const spaceAttr = /^\s|\s$|\s{2,}/.test(text) ? ' xml:space="preserve"' : ''
  return `<w:p><w:r><w:t${spaceAttr}>${safe}</w:t></w:r></w:p>`
}

function buildTableXml(rows: string[][]): string {
  const rowXml = rows
    .map((cells) => {
      const cellXml = cells
        .map((cell) => `<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>${buildParagraphXml(cell)}</w:tc>`)
        .join('')
      return `<w:tr>${cellXml}</w:tr>`
    })
    .join('')

  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>${rows[0]?.map(() => '<w:gridCol w:w="2000"/>').join('') ?? ''}</w:tblGrid>${rowXml}</w:tbl>`
}

function buildDocumentXmlFromBlocks(blocks: string[]): string {
  const bodyParts = blocks.map((block) => {
    if (block.includes(TABLE_COL_SEP)) {
      const rows = block.split('\n').map((line) => line.split(TABLE_COL_SEP).map((cell) => cell.trim()))
      return buildTableXml(rows)
    }
    return buildParagraphXml(block.replace(/\n/g, ' ').trim())
  })

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${WORD_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyParts.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

const MINIMAL_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`

const MINIMAL_ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const MINIMAL_DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

const MINIMAL_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${WORD_NS}">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="宋体"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`

/** 由纯文本生成新的 .docx（无原文件时使用） */
export async function createDocxFromPlainText(text: string): Promise<ArrayBuffer> {
  const blocks = parseEditedTextToBlocks(text)
  const zip = new JSZip()
  zip.file('[Content_Types].xml', MINIMAL_CONTENT_TYPES)
  zip.file('_rels/.rels', MINIMAL_ROOT_RELS)
  zip.file('word/_rels/document.xml.rels', MINIMAL_DOCUMENT_RELS)
  zip.file('word/styles.xml', MINIMAL_STYLES)
  zip.file('word/document.xml', buildDocumentXmlFromBlocks(blocks))

  return zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

export function buildDocxExportFileName(sourceName?: string | null, suffix = '已校对'): string {
  if (!sourceName) return `报告文档-${suffix}.docx`
  const base = sourceName.replace(/\.docx$/i, '')
  return `${base}-${suffix}.docx`
}

/** 统一导出入口：有原 docx 时默认写回；无原文件时默认 GB/T 重排版 */
export async function exportDocumentToDocx(
  editedText: string,
  options?: {
    originalBuffer?: ArrayBuffer | null
    originalFullText?: string
    fileName?: string | null
    /** true：按 GB/T 9704 重排版；false：写回原 docx。默认：无原文件时为 true，有原文件时为 false */
    preferFormatted?: boolean
  },
): Promise<DocxExportResult & { fileName: string }> {
  if (!editedText.trim()) {
    throw new Error('文档内容为空，无法导出 Word')
  }

  const exportName = buildDocxExportFileName(options?.fileName)
  const useFormatted = options?.preferFormatted ?? !options?.originalBuffer

  if (options?.originalBuffer && !useFormatted) {
    const unchanged =
      options.originalFullText !== undefined && options.originalFullText === editedText.trim()
    if (unchanged) {
      return {
        buffer: options.originalBuffer.slice(0),
        warnings: ['文本未修改，已导出原始 Word 文件'],
        fileName: exportName,
      }
    }

    const result = await exportDocxFromBuffer(options.originalBuffer, editedText, {
      originalFullText: options.originalFullText,
    })

    const fullExtract = await extractTextFromDocxXml(options.originalBuffer)
    const fullBlocks = parseEditedTextToBlocks(editedText)
    const fullOriginalBlocks = parseEditedTextToBlocks(fullExtract)
    if (fullOriginalBlocks.length > fullBlocks.length) {
      result.warnings.push('页眉、页脚等附加部分未在编辑器中展示，导出时保持 Word 原样')
    }

    return { ...result, fileName: exportName }
  }

  const buffer = await createFormattedDocxFromPlainText(editedText)
  return {
    buffer,
    warnings: [
      '已按 GB/T 9704-2012 国企公文格式排版（上报专项报告/请示通用版：小标宋标题、黑体主送、仿宋正文、28磅行距）',
    ],
    fileName: exportName,
  }
}

/** 调试/测试：对比 body 块数 */
export async function countBodyBlocksInDocx(buffer: ArrayBuffer): Promise<number> {
  const zip = await JSZip.loadAsync(buffer)
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) return 0
  return extractBodyBlocksFromDocumentXml(xml).length
}
