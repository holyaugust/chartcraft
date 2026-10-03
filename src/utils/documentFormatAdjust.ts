import { formatDocument } from './documentProofread'
import { normalizeDocumentStructure } from './documentFormatNormalize'
import { normalizeHierarchyNumbering } from './documentHierarchyNormalize'
import { collectStructuralProofreadIssues } from './documentStructureProofread'

export type FormatFixKind =
  | 'hierarchy'
  | 'structure'
  | 'blank_lines'
  | 'trailing_space'
  | 'indent'
  | 'advisory'

export interface FormatFixItem {
  id: string
  kind: FormatFixKind
  title: string
  detail: string
  /** 是否会随「应用智能排版」写入正文 */
  autoApply: boolean
  samples?: Array<{ original: string; replacement: string }>
}

export interface FormatAdjustReport {
  items: FormatFixItem[]
  previewContent: string
  changed: boolean
  changeLineCount: number
}

function countChangedLines(before: string, after: string): number {
  const a = before.replace(/\r\n/g, '\n').split('\n')
  const b = after.replace(/\r\n/g, '\n').split('\n')
  const max = Math.max(a.length, b.length)
  let count = 0
  for (let i = 0; i < max; i += 1) {
    if ((a[i] ?? '') !== (b[i] ?? '')) count += 1
  }
  return count
}

/** 强格式整理：层次序号 + 结构拆行 + 空白清理 */
export function applyDocumentFormat(content: string): string {
  const hierarchy = normalizeHierarchyNumbering(content)
  return formatDocument(hierarchy.content)
}

/** 分析正文格式问题，并生成规范化预览（不改正文） */
export function analyzeDocumentFormat(content: string): FormatAdjustReport {
  const original = content.replace(/\r\n/g, '\n')
  const hierarchy = normalizeHierarchyNumbering(original)
  const previewContent = formatDocument(hierarchy.content)
  const changed = previewContent !== original.trimEnd() && previewContent !== original
  const items: FormatFixItem[] = []

  if (hierarchy.convertedCount > 0) {
    items.push({
      id: 'hierarchy',
      kind: 'hierarchy',
      title: '层次序号规范化',
      detail: `按 GB/T 9704 调整 ${hierarchy.convertedCount} 处序号（一级「一、」、二级「（一）」、三级「1.」）`,
      autoApply: true,
      samples: hierarchy.samples,
    })
  }

  const structured = normalizeDocumentStructure(hierarchy.content)
  if (
    structured.replace(/\n{3,}/g, '\n\n').trimEnd() !==
    hierarchy.content.replace(/\n{3,}/g, '\n\n').trimEnd()
  ) {
    items.push({
      id: 'structure',
      kind: 'structure',
      title: '层次与落款规范化',
      detail: '拆分「标题+正文」混排行，整理附件与落款位置，补齐明显空缺层次下的占位提示',
      autoApply: true,
    })
  }

  if (/\n{3,}/.test(original)) {
    items.push({
      id: 'blank_lines',
      kind: 'blank_lines',
      title: '合并多余空行',
      detail: '将连续空行压缩为单空行，避免段落间距杂乱',
      autoApply: true,
    })
  }

  if (/[ \t]+$/m.test(original)) {
    items.push({
      id: 'trailing_space',
      kind: 'trailing_space',
      title: '清除行尾空白',
      detail: '去掉行末空格/制表符，减少导出与比对噪音',
      autoApply: true,
    })
  }

  if (/^[ \t　]+/m.test(original)) {
    items.push({
      id: 'indent',
      kind: 'indent',
      title: '清理行首缩进空格',
      detail: '纯文本中去掉手工缩进；编辑区「公文版式」与 Word 导出会显示规范首行缩进',
      autoApply: true,
    })
  }

  if (changed && items.filter((item) => item.autoApply).length === 0) {
    items.push({
      id: 'general',
      kind: 'structure',
      title: '整体排版整理',
      detail: '统一换行与段落空白，使层次更清晰',
      autoApply: true,
    })
  }

  const advisories = collectStructuralProofreadIssues(previewContent).filter(
    (issue) => issue.category === 'format',
  )
  for (const issue of advisories.slice(0, 6)) {
    items.push({
      id: `advisory-${issue.id}`,
      kind: 'advisory',
      title: '格式提示',
      detail: issue.message,
      autoApply: false,
    })
  }

  if (!changed && items.every((item) => !item.autoApply)) {
    items.unshift({
      id: 'ok',
      kind: 'advisory',
      title: '文本格式已较规范',
      detail:
        '可切换到「公文版式」查看标题居中、正文首行缩进等视觉效果；确认后直接「导出 Word」即可',
      autoApply: false,
    })
  }

  return {
    items,
    previewContent,
    changed,
    changeLineCount: changed ? countChangedLines(original, previewContent) : 0,
  }
}

const FORMAT_DONE_KEY = 'chartcraft-document-format-done'

export function loadFormatCompleted(fingerprint: string): boolean {
  if (!fingerprint) return false
  try {
    return localStorage.getItem(FORMAT_DONE_KEY) === fingerprint
  } catch {
    return false
  }
}

export function saveFormatCompleted(fingerprint: string): void {
  try {
    if (!fingerprint) {
      localStorage.removeItem(FORMAT_DONE_KEY)
      return
    }
    localStorage.setItem(FORMAT_DONE_KEY, fingerprint)
  } catch {
    /* ignore */
  }
}

export function clearFormatCompleted(): void {
  try {
    localStorage.removeItem(FORMAT_DONE_KEY)
  } catch {
    /* ignore */
  }
}
