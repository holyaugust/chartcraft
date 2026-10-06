import * as XLSX from 'xlsx'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { extractTextFromImage } from './smartGraphicOcr'
import { isSmartGraphicImageFile, readImageFileAsDataUrl } from './smartGraphicImage'
import { MAX_WRITE_REFERENCE_FILES, takeReferenceUploadBatch } from './writeReferenceLimits'

export { MAX_WRITE_REFERENCE_FILES, takeReferenceUploadBatch }

let pdfWorkerReady = false

async function ensurePdfWorker(): Promise<void> {
  if (pdfWorkerReady) return
  if (import.meta.env.VITEST) {
    const { createRequire } = await import('node:module')
    const { pathToFileURL } = await import('node:url')
    const require = createRequire(pathToFileURL(`${process.cwd()}/package.json`).href)
    GlobalWorkerOptions.workerSrc = pathToFileURL(
      require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
    ).href
  } else {
    GlobalWorkerOptions.workerSrc = workerUrl
  }
  pdfWorkerReady = true
}

function isReadableCode(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return true
  if (code >= 0x20 && code <= 0x7e) return true
  if (code >= 0x4e00 && code <= 0x9fff) return true
  if (code >= 0x3000 && code <= 0x303f) return true
  if (code >= 0xff00 && code <= 0xffef) return true
  return false
}

function keepDocChunk(chunk: string): boolean {
  const compact = chunk.replace(/\s/g, '')
  if (!compact) return false
  if (/[\u4e00-\u9fff]/.test(compact)) return compact.length >= 2
  return compact.length >= 8
}

function extractAligned(bytes: Uint8Array, offset: number): string {
  const chunks: string[] = []
  let current = ''
  for (let index = offset; index + 1 < bytes.length; index += 2) {
    const code = bytes[index] | (bytes[index + 1] << 8)
    if (isReadableCode(code)) {
      current += String.fromCharCode(code)
      continue
    }
    if (keepDocChunk(current)) chunks.push(current.trim())
    current = ''
  }
  if (keepDocChunk(current)) chunks.push(current.trim())

  const unique: string[] = []
  const seen = new Set<string>()
  for (const chunk of chunks) {
    const key = chunk.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(chunk)
  }
  return unique.join('\n')
}

function textScore(text: string): number {
  const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0
  return cjk * 5 + text.length
}

/** 从旧版 .doc 二进制中抽出可读正文。复杂表格可能不完整。 */
export function extractLegacyDocText(bytes: Uint8Array): string {
  const even = extractAligned(bytes, 0)
  const odd = extractAligned(bytes, 1)
  return textScore(odd) > textScore(even) ? odd : even
}

function sheetToText(sheet: XLSX.WorkSheet, name: string): string {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
  const lines = rows
    .map((row) => {
      const cells = (Array.isArray(row) ? row : []).map((cell) => String(cell ?? '').trim())
      if (cells.every((cell) => cell.length === 0)) return ''
      return cells.join(' | ')
    })
    .filter((line) => line.length > 0)
  if (lines.length === 0) return ''
  return `【${name}】\n${lines.join('\n')}`
}

async function extractSpreadsheetText(file: File): Promise<string> {
  const lower = file.name.toLowerCase()
  const workbook = lower.endsWith('.csv')
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
  const parts = workbook.SheetNames.map((name) => sheetToText(workbook.Sheets[name], name)).filter(Boolean)
  const text = parts.join('\n\n').trim()
  if (!text) throw new Error('表格中没有可识别的文字内容')
  return text
}

async function extractPdfText(file: File): Promise<string> {
  await ensurePdfWorker()
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await getDocument({ data }).promise
  const parts: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join('')
      .trim()
    if (line) parts.push(line)
  }
  const text = parts.join('\n').trim()
  if (!text) {
    throw new Error('PDF 中没有可识别的文字。扫描件请改用图片上传，以便识别图中文字')
  }
  return text
}

export async function extractWriteReferenceText(
  file: File,
  onProgress?: (message: string) => void,
): Promise<string> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.docx')) {
    const { importDocxFile } = await import('./wordImport')
    const result = await importDocxFile(file)
    return result.text
  }
  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.markdown')) {
    const text = (await file.text()).trim()
    if (!text) throw new Error('文档中没有可识别的文字内容')
    return text
  }
  if (lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return extractSpreadsheetText(file)
  }
  if (lower.endsWith('.pptx')) {
    const { importPptxFile } = await import('./pptxImport')
    const result = await importPptxFile(file)
    const text = result.combinedText.trim()
    if (!text) throw new Error('PPT 中没有可识别的文字内容（纯图片页暂不支持提取）')
    return text
  }
  if (lower.endsWith('.pdf')) return extractPdfText(file)
  if (lower.endsWith('.doc')) {
    const text = extractLegacyDocText(new Uint8Array(await file.arrayBuffer())).trim()
    if (!text) throw new Error('旧版 Word（.doc）未能抽出文字，请另存为 .docx 后再上传')
    return text
  }
  if (isSmartGraphicImageFile(file)) {
    onProgress?.('正在识别图片文字…')
    const dataUrl = await readImageFileAsDataUrl(file)
    return extractTextFromImage(dataUrl, onProgress)
  }
  throw new Error(`不支持「${file.name}」格式，请上传 Word、PDF、Excel、PPT、图片或文本`)
}
