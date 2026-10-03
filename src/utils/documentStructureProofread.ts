import { hasTableLikeRows } from './docxTextExtract'
import type { DocumentIssue } from './documentProofread'

let structuralIssueSeq = 0

function nextStructuralIssueId(): string {
  structuralIssueSeq += 1
  return `struct-${structuralIssueSeq}`
}

function pushLineIssue(
  issues: DocumentIssue[],
  text: string,
  start: number,
  end: number,
  category: DocumentIssue['category'],
  message: string,
  autoFixable = false,
): void {
  issues.push({
    id: nextStructuralIssueId(),
    category,
    message,
    start,
    end,
    original: text.slice(start, end),
    suggestion: '',
    autoFixable,
  })
}

function pushDocumentIssue(
  issues: DocumentIssue[],
  category: DocumentIssue['category'],
  message: string,
): void {
  issues.push({
    id: nextStructuralIssueId(),
    category,
    message,
    start: 0,
    end: 0,
    original: '',
    suggestion: '',
    autoFixable: false,
  })
}

/** 本地公文格式与逻辑结构检查（不依赖 AI） */
export function collectStructuralProofreadIssues(text: string): DocumentIssue[] {
  structuralIssueSeq = 0
  const issues: DocumentIssue[] = []
  if (!text.trim()) return issues

  const isTableDoc = hasTableLikeRows(text)
  const normalized = text.replace(/\r\n/g, '\n')

  const placeholderPatterns: Array<{ pattern: RegExp; message: string }> = [
    { pattern: /×××/g, message: '存在未填写占位符「×××」，请替换为实际内容' },
    { pattern: /【请填写[^】]*】/g, message: '存在未替换的模板占位符' },
    { pattern: /【[^】\n]{0,24}】/g, message: '【】占位内容尚未填写或仍为模板提示' },
  ]

  for (const { pattern, message } of placeholderPatterns) {
    for (const match of normalized.matchAll(pattern)) {
      const original = match[0]
      const start = match.index ?? 0
      if (original === '【】') {
        pushLineIssue(issues, normalized, start, start + original.length, 'logic', message)
        continue
      }
      if (/×{2,}|X{2,}|待填|请填写|占位|\.\.\.|……/.test(original)) {
        pushLineIssue(issues, normalized, start, start + original.length, 'logic', message)
      }
    }
  }

  if (!isTableDoc) {
    const hasMainRecipient = /[\u4e00-\u9fffA-Za-z0-9（）()]{2,}[：:]\s*$/m.test(normalized)
    if (normalized.length > 200 && !hasMainRecipient && /通知|报告|请示|函|意见/u.test(normalized)) {
      pushDocumentIssue(issues, 'format', '未见主送机关（机关名称后加全角冒号、顶格），请核对是否符合 GB/T 9704 格式')
    }

    if (/请示|报请|报批|恳请/u.test(normalized) && !/请批示|请审|盼复|请批准|妥否/u.test(normalized)) {
      pushDocumentIssue(issues, 'format', '请示类文书建议补充规范结语，如「以上请示，请批示」')
    }

    if (/汇报如下|工作报告|情况报告/u.test(normalized) && !/请示/u.test(normalized)) {
      if (!/特此报告|以上汇报|请审阅/u.test(normalized)) {
        pushDocumentIssue(issues, 'format', '报告类文书建议在结尾使用「特此报告」或「以上汇报，请审阅」等规范结语')
      }
    }

    if (/现通知如下|工作通知|放假通知/u.test(normalized) && !/特此通知|请遵照执行|请认真贯彻落实/u.test(normalized)) {
      pushDocumentIssue(issues, 'format', '通知类文书建议在结尾补充「特此通知」等规范结语')
    }

    const badHierarchy = normalized
      .split('\n')
      .filter((line) => line.trim() && !line.includes('|'))
      .filter((line) => /^[0-9]+[、.．]/u.test(line.trim()) && !/^\d{4}年/u.test(line.trim()))
    if (badHierarchy.length >= 2) {
      pushDocumentIssue(
        issues,
        'format',
        `有 ${badHierarchy.length} 处一级层次使用了阿拉伯数字序号，GB/T 9704 建议一级用「一、」、二级用「（一）」`,
      )
    }
  }

  const lines = normalized.split('\n')
  let lineOffset = 0
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) {
      lineOffset += line.length + 1
      continue
    }

    if (/^(同上|如前|见上述|见前文)$/u.test(trimmed)) {
      pushLineIssue(issues, normalized, lineOffset, lineOffset + line.length, 'logic', '指代过于笼统，建议写明具体对象或数据，避免读者无法对应')
    }

    if (/^(详见附件|见附件|见附表)[。.]?$/u.test(trimmed) && !/附件[：:]/u.test(normalized)) {
      pushLineIssue(issues, normalized, lineOffset, lineOffset + line.length, 'logic', '正文引用了附件，但未发现「附件：」说明行，请核对附件清单是否完整')
    }

    lineOffset += line.length + (i < lines.length - 1 ? 1 : 0)
  }

  if (/既.+又.+但/u.test(normalized.replace(/\s/g, ''))) {
    pushDocumentIssue(issues, 'logic', '同段存在「既…又…但…」式转折，请核对前后结论是否自相矛盾')
  }

  return issues
}
