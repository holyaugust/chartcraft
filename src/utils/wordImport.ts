import mammoth from 'mammoth'
import { extractTextFromDocxXml, hasTableLikeRows, cleanWordArtifactSpaces } from './docxTextExtract'

export interface DocxImportResult {
  text: string
  warnings: string[]
  arrayBuffer: ArrayBuffer
  fileName: string
  hasTables: boolean
}

function assertDocxFile(file: File): void {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    throw new Error('仅支持 .docx 格式的 Word 文档（.doc 请先另存为 .docx）')
  }
}

/** 始终优先 XML 提取（支持表格列分隔）；mammoth 仅作兜底 */
function pickExtractedText(xmlText: string, mammothText: string): string {
  const xml = xmlText.trim()
  const mammoth = mammothText.trim()
  if (xml) return xml
  return mammoth
}

/** 解析 Word：XML 直提文本（防漏字 + 表格友好）+ 原始二进制（版式预览） */
export async function importDocxFile(file: File): Promise<DocxImportResult> {
  assertDocxFile(file)

  const arrayBuffer = await file.arrayBuffer()
  const [xmlText, mammothResult] = await Promise.all([
    extractTextFromDocxXml(arrayBuffer),
    mammoth.extractRawText({ arrayBuffer }),
  ])

  const warnings = mammothResult.messages
    .map((message) => message.message)
    .filter((message) => message.trim().length > 0)

  const text = cleanWordArtifactSpaces(pickExtractedText(xmlText, mammothResult.value))
  if (!text) {
    throw new Error('文档中没有可识别的文字内容')
  }

  const hasTables = hasTableLikeRows(text)

  if (!xmlText.trim() && mammothResult.value.trim()) {
    warnings.push('XML 提取为空，已回退 mammoth 纯文本（表格结构可能丢失）')
  } else if (
    xmlText.trim() &&
    mammothResult.value.trim() &&
    xmlText.trim() !== mammothResult.value.trim()
  ) {
    warnings.push('已采用 XML 表格友好提取（与 mammoth 纯文本格式不同）')
  }

  return { text, warnings, arrayBuffer, fileName: file.name, hasTables }
}

/** @deprecated 请使用 importDocxFile */
export async function extractTextFromDocx(file: File): Promise<{ text: string; warnings: string[] }> {
  const { text, warnings } = await importDocxFile(file)
  return { text, warnings }
}
