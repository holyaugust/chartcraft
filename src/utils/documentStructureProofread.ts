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
  suggestion = '',
): void {
  issues.push({
    id: nextStructuralIssueId(),
    category,
    message,
    start,
    end,
    original: text.slice(start, end),
    suggestion,
    autoFixable,
  })
}

/** 单独成行的编号标题（一、/（一）/1.） */
function isStandaloneNumberedHeading(trimmed: string): boolean {
  if (!trimmed || trimmed.includes('|')) return false
  if (/^[一二三四五六七八九十百零〇]+[、．.]/u.test(trimmed)) return true
  if (/^（[一二三四五六七八九十百零〇\d]+）/u.test(trimmed)) return true
  if (/^\([一二三四五六七八九十百零〇\d]+\)/u.test(trimmed)) return true
  // 阿拉伯数字三级标题：短行且非年份起头
  if (
    /^\d+[、．.]\s*\S/u.test(trimmed) &&
    !/^\d{4}年/u.test(trimmed) &&
    trimmed.length <= 48
  ) {
    return true
  }
  return false
}

/** 标题行末尾带「。」：公文标题一般不用句号收束 */
function collectHeadingTrailingPeriodIssues(issues: DocumentIssue[], text: string): void {
  const lines = text.split('\n')
  let offset = 0
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()
    if (isStandaloneNumberedHeading(trimmed) && /。$/u.test(trimmed)) {
      const lead = line.match(/^\s*/)?.[0].length ?? 0
      const start = offset + lead
      const end = offset + line.length
      const original = text.slice(start, end)
      const suggestion = original.replace(/。(\s*)$/u, '$1')
      if (suggestion && suggestion !== original) {
        pushLineIssue(
          issues,
          text,
          start,
          end,
          'format',
          '单独成行的标题末尾不宜使用句号，建议去掉「。」',
          true,
          suggestion,
        )
      }
    }
    offset += line.length + (i < lines.length - 1 ? 1 : 0)
  }
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

const CN_ORDINAL_VALUE: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
}

function chineseOrdinalValue(token: string): number | null {
  if (token in CN_ORDINAL_VALUE) return CN_ORDINAL_VALUE[token]!
  if (token.startsWith('十') && token.length === 2) {
    const ones = CN_ORDINAL_VALUE[token[1]!]
    return ones ? 10 + ones : null
  }
  return null
}

/** 同层「（二）」后出现「（一）」等回退序号 */
function collectHeadingOrderIssues(issues: DocumentIssue[], text: string): void {
  const lines = text.split('\n')
  let offset = 0
  let lastLevel2: { value: number; line: string } | null = null
  let lastLevel1: { value: number; line: string } | null = null

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()
    if (!trimmed || trimmed.includes('|')) {
      offset += line.length + (i < lines.length - 1 ? 1 : 0)
      continue
    }

    const level2 = trimmed.match(/^（([一二三四五六七八九十]+)）/u)
    if (level2) {
      const value = chineseOrdinalValue(level2[1]!)
      if (value != null) {
        if (lastLevel2 && value < lastLevel2.value) {
          pushLineIssue(
            issues,
            text,
            offset,
            offset + line.length,
            'format',
            `二级标题序号顺序异常：前文序号更大，此处又出现「（${level2[1]}）」，请核对层级与序号`,
          )
        }
        lastLevel2 = { value, line: trimmed }
      }
      offset += line.length + (i < lines.length - 1 ? 1 : 0)
      continue
    }

    const level1 = trimmed.match(/^([一二三四五六七八九十]+)[、．.]/u)
    if (level1) {
      const value = chineseOrdinalValue(level1[1]!)
      if (value != null) {
        if (lastLevel1 && value < lastLevel1.value) {
          pushLineIssue(
            issues,
            text,
            offset,
            offset + line.length,
            'format',
            `一级标题序号顺序异常：前文已有「${lastLevel1.value === 1 ? '一' : lastLevel1.value}、」，此处序号回退，请核对章节顺序`,
          )
        }
        lastLevel1 = { value, line: trimmed }
        lastLevel2 = null
      }
    }

    offset += line.length + (i < lines.length - 1 ? 1 : 0)
  }
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

    collectHeadingOrderIssues(issues, normalized)
    collectHeadingTrailingPeriodIssues(issues, normalized)
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
