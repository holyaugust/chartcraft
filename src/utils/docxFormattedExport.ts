/**
 * GB/T 9704-2012 国企公文 Word 排版导出
 * 参照《国企标准公文模板（上报专项报告/请示通用版·GB/T 9704-2012）》
 */
import JSZip from 'jszip'
import {
  GBT9704_EXPORT_SPEC_NOTE,
  GBT9704_LINE_SPACING,
  GBT9704_PAGE_MARGINS,
  GBT9704_SIGNATURE_DATE_RIGHT_CHARS,
  GBT9704_SIGNATURE_ORG_RIGHT_CHARS,
  GBT9704_SIGNATURE_SPACE_BEFORE,
  GBT9704_SIZE_BODY,
  GBT9704_SIZE_HEADING1,
  GBT9704_SIZE_HEADING2,
  GBT9704_SIZE_TITLE,
} from '../data/gbt9704ExportSpec'
import { TABLE_COL_SEP } from './docxTextExtract'
import {
  expandAttachmentLine,
  isSignatureOrgLine,
  splitInlineHeadingBodyLine,
  stripLeadingIndent,
} from './documentFormatNormalize'

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

type ParagraphKind =
  | 'skip'
  | 'redHeader'
  | 'docNumber'
  | 'meta'
  | 'enterpriseBanner'
  | 'docKind'
  | 'title'
  | 'recipient'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'numberedItem'
  | 'tableCaption'
  | 'tableUnit'
  | 'closing'
  | 'attachment'
  | 'attachmentItem'
  | 'copyTo'
  | 'signatureOrg'
  | 'signatureDate'
  | 'footerNote'
  | 'metaLabel'
  | 'body'

interface ParagraphStyle {
  kind: ParagraphKind
  fontEastAsia: string
  fontAscii: string
  sizeHalfPoints: number
  bold: boolean
  color?: string
  align: 'left' | 'center' | 'right' | 'both'
  firstLineIndentChars?: number
  leftIndentChars?: number
  rightIndentChars?: number
  hangingIndentChars?: number
  spaceBefore?: number
  spaceAfter?: number
}

function escapeXmlText(text: string): string {
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

function normalizeBodyText(line: string): string {
  return stripLeadingIndent(line.trim())
}

function getNumberPrefixUnits(text: string): number {
  const match = text.match(/^(\d+[．.、]\s*)/)
  if (!match) return 0
  return match[1].length * 100
}

/** 「附件：」与附件序号均左缩进 2 字符，序号与「附件」二字对齐 */
const ATTACHMENT_LABEL_INDENT_CHARS = 200

interface ExportLinePart {
  text: string
  kind?: ParagraphKind
}

/** 将「（一）标题。正文…」等同段混排拆成标题段 + 正文段 */
function splitInlineHeadingBody(line: string, kind: ParagraphKind): ExportLinePart[] {
  const parts = splitInlineHeadingBodyLine(line)
  if (parts.length === 1) return [{ text: line, kind }]
  return [
    { text: parts[0], kind },
    { text: parts[1], kind: 'body' },
  ]
}

function expandExportParts(line: string, kind: ParagraphKind): ExportLinePart[] {
  if (kind === 'attachment') {
    return expandAttachmentLine(line).map((text) => ({ text }))
  }
  if (isSectionHeadingKind(kind) || kind === 'heading3') {
    return splitInlineHeadingBody(line, kind)
  }
  return [{ text: line, kind }]
}

function applyDynamicIndent(style: ParagraphStyle, text: string): ParagraphStyle {
  if (style.kind === 'numberedItem') {
    const prefixUnits = getNumberPrefixUnits(text)
    if (prefixUnits <= 0) {
      return { ...style, firstLineIndentChars: 200, leftIndentChars: 0, hangingIndentChars: 0 }
    }

    return {
      ...style,
      firstLineIndentChars: 0,
      leftIndentChars: 200 + prefixUnits,
      hangingIndentChars: prefixUnits,
    }
  }

  if (style.kind === 'attachmentItem') {
    const prefixUnits = getNumberPrefixUnits(text)
    if (prefixUnits <= 0) {
      return { ...style, firstLineIndentChars: 0, leftIndentChars: ATTACHMENT_LABEL_INDENT_CHARS }
    }

    return {
      ...style,
      firstLineIndentChars: 0,
      leftIndentChars: ATTACHMENT_LABEL_INDENT_CHARS + prefixUnits,
      hangingIndentChars: prefixUnits,
    }
  }

  return style
}
function isShortNumberedHeading(line: string): boolean {
  const trimmed = line.trim()
  if (!/^\d+[．.、]\s/.test(trimmed)) return false
  if (trimmed.length > 48) return false
  if (/[；。！？]/.test(trimmed)) return false
  return true
}

function isSectionHeadingKind(kind: ParagraphKind): boolean {
  return kind === 'heading1' || kind === 'heading2' || kind === 'heading3' || kind === 'heading4'
}

function isGuidingColonLine(trimmed: string): boolean {
  return /：\s*$/u.test(trimmed) && trimmed.length <= 40 && !trimmed.startsWith('【')
}

function classifyLine(line: string, previousKind?: ParagraphKind): ParagraphKind {
  const trimmed = line.trim()
  if (!trimmed) return 'skip'

  if (/^【文种[：:]/.test(trimmed)) return 'docKind'
  if (/^【红头[：:]/.test(trimmed)) return 'redHeader'
  if (/^【文号[：:]/.test(trimmed)) return 'docNumber'
  if (/^【秘级[：:]|^【紧急程度[：:]/.test(trimmed)) return 'meta'
  if (/^【内部事务/.test(trimmed)) return 'enterpriseBanner'
  if (/^【标题[：:]/.test(trimmed)) return 'title'
  if (/^【(报告期|关联纪要|台账期间)[：:]/.test(trimmed)) return 'metaLabel'
  if (/^【第[×X\d]+号】/.test(trimmed)) return 'metaLabel'
  if (/^附件[：:]/u.test(trimmed)) return 'attachment'
  if (/^抄送[：:]|^分送[：:]/u.test(trimmed)) return 'copyTo'
  if (/^（此件/u.test(trimmed)) return 'footerNote'
  if (
    /^特此(报告|呈报|通知|通报|公告|通告|公布|函告)|^以上(请示|议案|报告)|^此复|^本(决定|命令|决议)自|^请结合实际/u.test(
      trimmed,
    )
  ) {
    return 'closing'
  }
  if (/^表\d+/u.test(trimmed)) return 'tableCaption'
  if (/^单位[：:]/u.test(trimmed)) return 'tableUnit'

  if (/^[一二三四五六七八九十百零〇]+[、．.](?!(\d|．|\.))/u.test(trimmed)) return 'heading1'
  if (/^（[一二三四五六七八九十百零〇]+）/u.test(trimmed)) return 'heading2'
  if (/^（\d+）/.test(trimmed)) return 'heading4'

  if (isShortNumberedHeading(trimmed)) return 'heading3'

  if (/^\d+[．.、]\s/.test(trimmed)) {
    if (previousKind === 'attachment' || previousKind === 'attachmentItem') {
      return 'attachmentItem'
    }
    return 'numberedItem'
  }

  if (/^[ 　]+\d+[．.]/.test(line)) return 'attachmentItem'

  if (isGuidingColonLine(trimmed)) {
    if (previousKind && previousKind !== 'title' && isSectionHeadingKind(previousKind)) {
      return 'body'
    }
    return 'recipient'
  }

  if (/^[\dX×]{4}年[\dX×]{1,2}月[\dX×]{1,2}日/u.test(trimmed)) {
    if (/印发$/.test(trimmed)) return 'footerNote'
    return 'signatureDate'
  }
  if (isSignatureOrgLine(trimmed)) return 'signatureOrg'

  if (
    /(有限公司|集团)关于.*的(报告|请示)/u.test(trimmed) &&
    trimmed.length <= 80 &&
    !trimmed.startsWith('【')
  ) {
    return 'title'
  }

  if (/^关于.*的(请示|报告|通知|通报|意见|函|决定|批复|议案|方案|说明|命令|公告|通告|公报|纪要)/u.test(trimmed) && trimmed.length <= 80) {
    return 'title'
  }

  if (/^.+会议纪要$/u.test(trimmed) && trimmed.length <= 40) return 'title'

  return 'body'
}

function styleForKind(kind: ParagraphKind): ParagraphStyle {
  const bodyBase: ParagraphStyle = {
    kind,
    fontEastAsia: '仿宋_GB2312',
    fontAscii: 'Times New Roman',
    sizeHalfPoints: GBT9704_SIZE_BODY,
    bold: false,
    align: 'both',
    firstLineIndentChars: 200,
    spaceBefore: 120,
    spaceAfter: 120,
  }

  switch (kind) {
    case 'skip':
    case 'docKind':
      return { ...bodyBase, kind }
    case 'redHeader':
      return {
        kind,
        fontEastAsia: '小标宋',
        fontAscii: 'Times New Roman',
        sizeHalfPoints: GBT9704_SIZE_TITLE,
        bold: true,
        color: 'FF0000',
        align: 'center',
        spaceAfter: 120,
      }
    case 'docNumber':
      return { ...bodyBase, align: 'center', firstLineIndentChars: 0, leftIndentChars: 0, spaceAfter: 160 }
    case 'meta':
      return { ...bodyBase, align: 'center', firstLineIndentChars: 0, leftIndentChars: 0, spaceAfter: 200 }
    case 'enterpriseBanner':
      return { ...bodyBase, sizeHalfPoints: 28, align: 'center', firstLineIndentChars: 0, spaceAfter: 160 }
    case 'metaLabel':
      return { ...bodyBase, bold: true, align: 'left', firstLineIndentChars: 0, spaceAfter: 80 }
    case 'title':
      return {
        kind,
        fontEastAsia: '小标宋',
        fontAscii: 'Times New Roman',
        sizeHalfPoints: GBT9704_SIZE_TITLE,
        bold: true,
        align: 'center',
        firstLineIndentChars: 0,
        spaceBefore: 200,
        spaceAfter: 280,
      }
    case 'recipient':
      return {
        kind,
        fontEastAsia: '黑体',
        fontAscii: 'Times New Roman',
        sizeHalfPoints: GBT9704_SIZE_BODY,
        bold: true,
        align: 'left',
        firstLineIndentChars: 0,
        spaceAfter: 160,
      }
    case 'heading1':
      return {
        kind,
        fontEastAsia: '黑体',
        fontAscii: 'Times New Roman',
        sizeHalfPoints: GBT9704_SIZE_HEADING1,
        bold: true,
        align: 'left',
        firstLineIndentChars: 0,
        spaceBefore: 320,
        spaceAfter: 120,
      }
    case 'heading2':
      return {
        kind,
        fontEastAsia: '楷体_GB2312',
        fontAscii: 'Times New Roman',
        sizeHalfPoints: GBT9704_SIZE_HEADING2,
        bold: true,
        align: 'left',
        firstLineIndentChars: 0,
        spaceBefore: 300,
        spaceAfter: 120,
      }
    case 'heading3':
      return {
        kind,
        fontEastAsia: '仿宋_GB2312',
        fontAscii: 'Times New Roman',
        sizeHalfPoints: GBT9704_SIZE_BODY,
        bold: true,
        align: 'left',
        firstLineIndentChars: 0,
        spaceBefore: 120,
        spaceAfter: 120,
      }
    case 'heading4':
      return {
        kind,
        fontEastAsia: '仿宋_GB2312',
        fontAscii: 'Times New Roman',
        sizeHalfPoints: GBT9704_SIZE_BODY,
        bold: false,
        align: 'left',
        firstLineIndentChars: 0,
        spaceBefore: 120,
        spaceAfter: 120,
      }
    case 'numberedItem':
      return {
        ...bodyBase,
        firstLineIndentChars: 0,
        leftIndentChars: 0,
        hangingIndentChars: 0,
      }
    case 'closing':
    case 'body':
      return bodyBase
    case 'tableCaption':
      return { ...bodyBase, bold: true, firstLineIndentChars: 0, align: 'left' }
    case 'tableUnit':
      return { ...bodyBase, firstLineIndentChars: 0, align: 'left' }
    case 'attachment':
      return {
        ...bodyBase,
        firstLineIndentChars: ATTACHMENT_LABEL_INDENT_CHARS,
        leftIndentChars: 0,
        align: 'left',
        spaceBefore: GBT9704_LINE_SPACING,
        spaceAfter: 0,
      }
    case 'attachmentItem':
      return {
        ...bodyBase,
        leftIndentChars: 0,
        firstLineIndentChars: 0,
        hangingIndentChars: 0,
        align: 'left',
        spaceBefore: 0,
        spaceAfter: 0,
      }
    case 'copyTo':
      return { ...bodyBase, firstLineIndentChars: 0, spaceBefore: 120 }
    case 'signatureOrg':
      return {
        ...bodyBase,
        align: 'right',
        firstLineIndentChars: 0,
        leftIndentChars: 0,
        rightIndentChars: GBT9704_SIGNATURE_ORG_RIGHT_CHARS,
        spaceBefore: GBT9704_SIGNATURE_SPACE_BEFORE,
        spaceAfter: 0,
      }
    case 'signatureDate':
      return {
        ...bodyBase,
        align: 'right',
        firstLineIndentChars: 0,
        leftIndentChars: 0,
        rightIndentChars: GBT9704_SIGNATURE_DATE_RIGHT_CHARS,
        spaceAfter: 200,
      }
    case 'footerNote':
      return { ...bodyBase, firstLineIndentChars: 200, leftIndentChars: 0, spaceBefore: 120 }
    default:
      return bodyBase
  }
}

function displayTextForLine(line: string, kind: ParagraphKind): string {
  const trimmed = line.trim()
  if (kind === 'docKind') return ''

  if (kind === 'redHeader' || kind === 'title' || kind === 'docNumber' || kind === 'enterpriseBanner') {
    return unwrapMarkerLine(trimmed)
  }
  if (kind === 'metaLabel') {
    const unwrapped = unwrapMarkerLine(trimmed)
    return unwrapped.startsWith('【') ? trimmed.replace(/^【|】$/g, '') : unwrapped
  }
  if (kind === 'meta') {
    return trimmed.replace(/【([^】]+)】/g, (_, inner: string) => {
      const colonIdx = inner.search(/[：:]/)
      return colonIdx >= 0 ? inner.slice(colonIdx + 1).trim() : inner
    })
  }
  if (
    kind === 'body' ||
    kind === 'closing' ||
    kind === 'numberedItem' ||
    kind === 'footerNote'
  ) {
    return normalizeBodyText(trimmed)
  }
  if (kind === 'attachmentItem') return stripLeadingIndent(trimmed)
  if (
    kind === 'heading1' ||
    kind === 'heading2' ||
    kind === 'heading3' ||
    kind === 'heading4' ||
    kind === 'tableCaption' ||
    kind === 'tableUnit' ||
    kind === 'attachment' ||
    kind === 'copyTo' ||
    kind === 'recipient' ||
    kind === 'signatureOrg' ||
    kind === 'signatureDate'
  ) {
    return stripLeadingIndent(trimmed)
  }
  return trimmed
}

function buildIndentXml(style: ParagraphStyle): string {
  const parts: string[] = []
  if (style.leftIndentChars) parts.push(`w:leftChars="${style.leftIndentChars}"`)
  if (style.rightIndentChars) parts.push(`w:rightChars="${style.rightIndentChars}"`)
  if (style.hangingIndentChars) parts.push(`w:hangingChars="${style.hangingIndentChars}"`)
  if (style.firstLineIndentChars && style.firstLineIndentChars > 0) {
    parts.push(`w:firstLineChars="${style.firstLineIndentChars}"`)
  }
  if (parts.length === 0) return ''
  return `<w:ind ${parts.join(' ')}/>`
}

function buildRunXml(text: string, style: ParagraphStyle): string {
  const safe = escapeXmlText(text)
  const spaceAttr = /^\s|\s$|\s{2,}/.test(text) ? ' xml:space="preserve"' : ''
  const colorXml = style.color ? `<w:color w:val="${style.color}"/>` : ''
  const boldXml = style.bold ? '<w:b/><w:bCs/>' : ''

  return `<w:r>
    <w:rPr>
      <w:rFonts w:ascii="${style.fontAscii}" w:hAnsi="${style.fontAscii}" w:eastAsia="${style.fontEastAsia}" w:cs="${style.fontEastAsia}"/>
      <w:sz w:val="${style.sizeHalfPoints}"/>
      <w:szCs w:val="${style.sizeHalfPoints}"/>
      ${boldXml}
      ${colorXml}
    </w:rPr>
    <w:t${spaceAttr}>${safe}</w:t>
  </w:r>`
}

function buildParagraphXml(line: string, kind: ParagraphKind): string {
  if (kind === 'skip' || kind === 'docKind') return ''

  const baseStyle = styleForKind(kind)
  const text = displayTextForLine(line, kind)
  if (!text) return ''

  const style = applyDynamicIndent(baseStyle, text)

  const jcMap = { left: 'left', center: 'center', right: 'right', both: 'both' }
  const spacingParts = [`w:line="${GBT9704_LINE_SPACING}" w:lineRule="exact"`]
  if (style.spaceBefore) spacingParts.push(`w:before="${style.spaceBefore}"`)
  if (style.spaceAfter) spacingParts.push(`w:after="${style.spaceAfter}"`)

  return `<w:p>
    <w:pPr>
      <w:jc w:val="${jcMap[style.align]}"/>
      <w:spacing ${spacingParts.join(' ')}/>
      ${buildIndentXml(style)}
    </w:pPr>
    ${buildRunXml(text, style)}
  </w:p>`
}

function buildTableXml(rows: string[][]): string {
  const colCount = Math.max(...rows.map((row) => row.length), 1)
  const colWidth = Math.floor(9000 / colCount)
  const bodyStyle = styleForKind('body')

  const rowXml = rows
    .map((cells) => {
      const padded = [...cells]
      while (padded.length < colCount) padded.push('')
      const cellXml = padded
        .map((cell) => {
          const cellText = cell.trim() ? normalizeBodyText(cell.trim()) : ''
          return `<w:tc>
            <w:tcPr>
              <w:tcW w:w="${colWidth}" w:type="dxa"/>
              <w:tcMar>
                <w:top w:w="60" w:type="dxa"/>
                <w:left w:w="120" w:type="dxa"/>
                <w:bottom w:w="30" w:type="dxa"/>
                <w:right w:w="120" w:type="dxa"/>
              </w:tcMar>
            </w:tcPr>
            <w:p>
              <w:pPr>
                <w:spacing w:line="${GBT9704_LINE_SPACING}" w:lineRule="exact"/>
                <w:ind w:firstLineChars="0"/>
              </w:pPr>
              ${cellText ? buildRunXml(cellText, bodyStyle) : '<w:r><w:t></w:t></w:r>'}
            </w:p>
          </w:tc>`
        })
        .join('')
      return `<w:tr>${cellXml}</w:tr>`
    })
    .join('')

  const gridCols = Array.from({ length: colCount }, () => `<w:gridCol w:w="${colWidth}"/>`).join('')

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="DEE0E3"/>
        <w:left w:val="single" w:sz="4" w:color="DEE0E3"/>
        <w:bottom w:val="single" w:sz="4" w:color="DEE0E3"/>
        <w:right w:val="single" w:sz="4" w:color="DEE0E3"/>
        <w:insideH w:val="single" w:sz="4" w:color="DEE0E3"/>
        <w:insideV w:val="single" w:sz="4" w:color="DEE0E3"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${gridCols}</w:tblGrid>
    ${rowXml}
  </w:tbl>`
}

function buildFormattedDocumentXml(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  const bodyParts: string[] = []

  let i = 0
  let previousKind: ParagraphKind | undefined
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
      const rows = tableLines.map((row) => row.split(TABLE_COL_SEP).map((cell) => cell.trim()))
      bodyParts.push(buildTableXml(rows))
      continue
    }

    const kind = classifyLine(line, previousKind)
    if (kind !== 'skip' && kind !== 'docKind') {
      for (const part of expandExportParts(line, kind)) {
        const partKind = part.kind ?? classifyLine(part.text, previousKind)
        if (partKind === 'skip' || partKind === 'docKind') continue
        const paragraph = buildParagraphXml(part.text, partKind)
        if (paragraph) {
          bodyParts.push(paragraph)
          previousKind = partKind
        }
      }
    }
    i += 1
  }

  const { top, right, bottom, left, header, footer } = GBT9704_PAGE_MARGINS

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${WORD_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyParts.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="${top}" w:right="${right}" w:bottom="${bottom}" w:left="${left}" w:header="${header}" w:footer="${footer}" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

const FORMATTED_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`

const FORMATTED_ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const FORMATTED_DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`

const FORMATTED_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${WORD_NS}">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="仿宋_GB2312"/>
        <w:sz w:val="${GBT9704_SIZE_BODY}"/>
        <w:szCs w:val="${GBT9704_SIZE_BODY}"/>
        <w:lang w:val="en-US" w:eastAsia="zh-CN"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="${GBT9704_LINE_SPACING}" w:lineRule="exact"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:line="${GBT9704_LINE_SPACING}" w:lineRule="exact"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="仿宋_GB2312"/>
      <w:sz w:val="${GBT9704_SIZE_BODY}"/>
      <w:szCs w:val="${GBT9704_SIZE_BODY}"/>
    </w:rPr>
  </w:style>
</w:styles>`

const FORMATTED_SETTINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="${WORD_NS}">
  <w:characterSpacingControl w:val="compressPunctuation"/>
  <w:compat>
    <w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>
  </w:compat>
</w:settings>`

/** 按 GB/T 9704-2012 由纯文本生成 .docx */
export async function createFormattedDocxFromPlainText(text: string): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', FORMATTED_CONTENT_TYPES)
  zip.file('_rels/.rels', FORMATTED_ROOT_RELS)
  zip.file('word/_rels/document.xml.rels', FORMATTED_DOCUMENT_RELS)
  zip.file('word/styles.xml', FORMATTED_STYLES)
  zip.file('word/settings.xml', FORMATTED_SETTINGS)
  zip.file('word/document.xml', buildFormattedDocumentXml(text))

  return zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

export function looksLikeOfficialDocument(text: string): boolean {
  return (
    /【红头[：:]/u.test(text) ||
    /【标题[：:]/u.test(text) ||
    /【文种[：:]/u.test(text) ||
    /【文号[：:]/u.test(text) ||
    /【内部事务/u.test(text) ||
    /^[一二三四五六七八九十]+[、．.]/m.test(text)
  )
}

export { GBT9704_EXPORT_SPEC_NOTE }
