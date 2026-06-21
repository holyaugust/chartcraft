import { readWriteReferenceFile } from './documentWrite'

export const DEFAULT_PROJECT_PROMPT =
  '请根据上传材料生成结构清晰、适合正式汇报的 PPT，突出核心结论与关键数据。'

export const PPT_SOURCE_ACCEPT = '.pdf,.docx,.txt,.md,.markdown'

export type PptSourceDocumentKind = 'pdf' | 'docx' | 'text'

/** 阶段 1 统一材料（内存态；刷新后需重新上传） */
export interface PptSourceDocument {
  name: string
  file: File
  text: string
  kind: PptSourceDocumentKind
}

export async function readPptSourceDocument(file: File): Promise<PptSourceDocument> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.pdf')) {
    return { name: file.name, file, text: '', kind: 'pdf' }
  }
  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.markdown')) {
    const text = await file.text()
    if (!text.trim()) {
      throw new Error('文档中未识别到可用文字')
    }
    return { name: file.name, file, text, kind: 'text' }
  }
  if (lower.endsWith('.docx')) {
    const text = await readWriteReferenceFile(file)
    if (!text.trim()) {
      throw new Error('文档中未识别到可用文字')
    }
    return { name: file.name, file, text, kind: 'docx' }
  }
  throw new Error(`不支持「${file.name}」格式，请上传 PDF / Word / 文本`)
}

export function pptSourceDocumentHint(doc: PptSourceDocument | null): string | null {
  if (!doc) return null
  if (doc.kind === 'pdf') {
    return 'PDF 可用于「智能设计稿」；「标准大纲」需 Word 或文本'
  }
  return `已提取 ${doc.text.length} 字 · 两种生成方式共用此材料`
}
