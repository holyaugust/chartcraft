import { hasTableLikeRows } from './docxTextExtract'
import type { DocumentIssue } from './documentProofread'
import {
  extractDocumentHeadings,
  isArabicHeadingMarker,
  isChineseLevel1Marker,
  type DocumentHeading,
} from './documentHeadings'

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

/** 标题行末尾带「。」：公文标题一般不用句号收束 */
function collectHeadingTrailingPeriodIssues(issues: DocumentIssue[], text: string): void {
  for (const heading of extractDocumentHeadings(text)) {
    const trimmed = heading.title.trim()
    if (!/。$/u.test(trimmed)) continue
    const original = text.slice(heading.start, heading.end)
    const suggestion = original.replace(/。(\s*)$/u, '$1')
    if (suggestion && suggestion !== original) {
      pushLineIssue(
        issues,
        text,
        heading.start,
        heading.end,
        'format',
        '单独成行的标题末尾不宜使用句号，建议去掉「。」',
        true,
        suggestion,
      )
    }
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

function headingOrdinalValue(trimmed: string, level: number): number | null {
  if (level === 1) {
    const m = trimmed.match(/^([一二三四五六七八九十]+)[、．.]/u)
    return m ? chineseOrdinalValue(m[1]!) : null
  }
  if (level === 2) {
    const m = trimmed.match(/^（([一二三四五六七八九十]+)）/u) ?? trimmed.match(/^\(([一二三四五六七八九十]+)\)/u)
    return m ? chineseOrdinalValue(m[1]!) : null
  }
  if (level === 3) {
    const m = trimmed.match(/^(\d+)[、．.]/u)
    return m ? Number(m[1]) : null
  }
  if (level === 4) {
    const m = trimmed.match(/^（(\d+)）/u) ?? trimmed.match(/^\((\d+)\)/u)
    return m ? Number(m[1]) : null
  }
  return null
}

/** 阿拉伯数字被当成全文一级标题使用（且无汉字一级）时，逐条可定位提示 */
function collectArabicTopLevelMisuseIssues(issues: DocumentIssue[], text: string, headings: DocumentHeading[]): void {
  const hasChineseL1 = headings.some((item) => isChineseLevel1Marker(item.title))
  if (hasChineseL1) return

  const arabicTops = headings.filter(
    (item) => item.level === 3 && isArabicHeadingMarker(item.title) && /^\d+[、．.]/u.test(item.title),
  )
  if (arabicTops.length < 2) return

  for (const heading of arabicTops) {
    pushLineIssue(
      issues,
      text,
      heading.start,
      heading.end,
      'format',
      '此处使用阿拉伯数字作一级标题，GB/T 9704 建议一级用「一、」、二级用「（一）」',
    )
  }
}

/**
 * 基于统一标题层级：序号回退、层级跳跃、二级样式混用。
 */
function collectHeadingStructureIssues(issues: DocumentIssue[], text: string): void {
  const headings = extractDocumentHeadings(text).filter((item) => !item.title.includes('|'))
  collectArabicTopLevelMisuseIssues(issues, text, headings)

  const hasCnL2 = headings.some((item) => item.level === 2)
  const hasArL4 = headings.some((item) => item.level === 4)
  if (hasCnL2 && hasArL4) {
    const firstMixed = headings.find((item) => item.level === 4) ?? headings.find((item) => item.level === 2)!
    pushLineIssue(
      issues,
      text,
      firstMixed.start,
      firstMixed.end,
      'format',
      '二级层次序号样式混用：同时出现「（一）」与「（1）」类写法，建议统一为汉字序号「（一）」',
    )
  }

  let lastLevel: number | null = null
  let lastOrdinalByLevel: Partial<Record<1 | 2 | 3 | 4, number>> = {}

  for (const heading of headings) {
    const level = heading.level
    if (lastLevel != null && level > lastLevel + 1) {
      pushLineIssue(
        issues,
        text,
        heading.start,
        heading.end,
        'format',
        `标题层级跳跃：前一标题为${lastLevel}级，此处直接出现${level}级，请核对是否缺少中间层次`,
      )
    }

    const ordinal = headingOrdinalValue(heading.title, level)
    if (ordinal != null) {
      const prev = lastOrdinalByLevel[level]
      if (prev != null && ordinal < prev) {
        const label =
          level === 1 ? '一级' : level === 2 ? '二级' : level === 3 ? '三级' : '四级'
        pushLineIssue(
          issues,
          text,
          heading.start,
          heading.end,
          'format',
          `${label}标题序号顺序异常：前文序号更大，此处又回退，请核对层级与序号`,
        )
      }
      lastOrdinalByLevel[level] = ordinal
    }

    if (level === 1) {
      lastOrdinalByLevel = { 1: lastOrdinalByLevel[1] }
    } else if (level === 2) {
      lastOrdinalByLevel = {
        1: lastOrdinalByLevel[1],
        2: lastOrdinalByLevel[2],
      }
    } else if (level === 3) {
      lastOrdinalByLevel = {
        1: lastOrdinalByLevel[1],
        2: lastOrdinalByLevel[2],
        3: lastOrdinalByLevel[3],
      }
    }

    lastLevel = level
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

    collectHeadingStructureIssues(issues, normalized)
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
