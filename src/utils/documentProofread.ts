import { resolveIssueRange } from './documentLocate'
import { normalizeDocumentStructure } from './documentFormatNormalize'

export type IssueCategory = 'typo' | 'grammar' | 'punctuation' | 'style' | 'format'

export interface DocumentIssue {
  id: string
  category: IssueCategory
  message: string
  start: number
  end: number
  original: string
  suggestion: string
  autoFixable: boolean
}

export interface ProofreadResult {
  issues: DocumentIssue[]
  formatted: string
}

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  typo: '错别字',
  grammar: '语句',
  punctuation: '标点',
  style: '表达',
  format: '格式',
}

export function getIssueCategoryLabel(category: IssueCategory): string {
  return CATEGORY_LABELS[category]
}

/** 修改前后除空白外完全相同（常见于 Word 转文本后 AI 误报空格） */
export function isWhitespaceOnlyChange(original: string, suggestion: string): boolean {
  if (original === suggestion) return false
  return original.replace(/\s/g, '') === suggestion.replace(/\s/g, '')
}

export function shouldSkipProofreadIssue(original: string, suggestion: string): boolean {
  return isWhitespaceOnlyChange(original, suggestion)
}

const TRAILING_PUNCT_CHARS = new Set([
  '。', '！', '？', '；', '，', '、', '：', ':', '.', '!', '?', ',', ';',
  '」', '』', '）', ')', '"', '"', '\u2018', '\u2019',
])

function isTrailingPunctuationChar(char: string): boolean {
  return TRAILING_PUNCT_CHARS.has(char)
}

/** 建议末尾是标点且原文后续也是标点时，去掉建议尾部，避免「。，」「。。」等连用 */
export function trimDuplicateTrailingPunctuation(
  text: string,
  end: number,
  suggestion: string,
): string {
  if (!suggestion || end >= text.length) return suggestion

  let result = suggestion
  while (
    result.length > 0 &&
    end < text.length &&
    isTrailingPunctuationChar(result[result.length - 1]) &&
    isTrailingPunctuationChar(text[end])
  ) {
    result = result.slice(0, -1)
  }
  return result
}

interface TextReplacement {
  start: number
  end: number
  suggestion: string
  message: string
  category: IssueCategory
  autoFixable: boolean
}

let issueSeq = 0

function nextIssueId(): string {
  issueSeq += 1
  return `issue-${issueSeq}`
}

const TYPO_RULES: Array<{ pattern: RegExp; suggestion: string; message: string }> = [
  { pattern: /因该/g, suggestion: '应该', message: '「因该」应为「应该」' },
  { pattern: /按装/g, suggestion: '安装', message: '「按装」应为「安装」' },
  { pattern: /做业/g, suggestion: '作业', message: '「做业」应为「作业」' },
  { pattern: /既使/g, suggestion: '即使', message: '「既使」应为「即使」' },
  { pattern: /侯选/g, suggestion: '候选', message: '「侯选」应为「候选」' },
  { pattern: /在次/g, suggestion: '再次', message: '「在次」应为「再次」' },
  { pattern: /在见/g, suggestion: '再见', message: '「在见」应为「再见」' },
  { pattern: /以经/g, suggestion: '已经', message: '「以经」应为「已经」' },
  { pattern: /帐号/g, suggestion: '账号', message: '「帐号」建议写作「账号」' },
  { pattern: /其它/g, suggestion: '其他', message: '「其它」建议统一为「其他」' },
]

const GRAMMAR_RULES: Array<{ pattern: RegExp; suggestion: string; message: string }> = [
  { pattern: /涉及到/g, suggestion: '涉及', message: '「涉及到」冗余，建议改为「涉及」' },
  { pattern: /目的是为了/g, suggestion: '目的是', message: '「目的是为了」语义重复' },
  { pattern: /由于([\u4e00-\u9fff]{1,20})的原因/g, suggestion: '由于$1', message: '「由于…的原因」表述冗余' },
  { pattern: /可以能够/g, suggestion: '可以', message: '「可以能够」语义重复' },
  { pattern: /进行了([\u4e00-\u9fff]{1,8})的操作/g, suggestion: '$1', message: '「进行了…的操作」表述啰嗦' },
]

const PUNCTUATION_RULES: Array<{ pattern: RegExp; suggestion: string; message: string }> = [
  { pattern: /,/g, suggestion: '，', message: '英文逗号应改为中文逗号' },
  { pattern: /;/g, suggestion: '；', message: '英文分号应改为中文分号' },
  { pattern: /!/g, suggestion: '！', message: '英文叹号应改为中文叹号' },
  { pattern: /\?/g, suggestion: '？', message: '英文问号应改为中文问号' },
  { pattern: /\(/g, suggestion: '（', message: '英文括号应改为中文括号' },
  { pattern: /\)/g, suggestion: '）', message: '英文括号应改为中文括号' },
  { pattern: /,{2,}/g, suggestion: '，', message: '重复逗号' },
  { pattern: /。{2,}/g, suggestion: '。', message: '重复句号' },
]

function resolveSuggestion(template: string, match: RegExpMatchArray): string {
  return template.replace(/\$(\d+)/g, (_, index) => match[Number(index)] ?? '')
}

function collectRules(
  text: string,
  rules: Array<{ pattern: RegExp; suggestion: string; message: string }>,
  category: IssueCategory,
): TextReplacement[] {
  const results: TextReplacement[] = []

  for (const rule of rules) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`)
    for (const match of text.matchAll(pattern)) {
      const original = match[0]
      const start = match.index ?? 0
      const suggestion = resolveSuggestion(rule.suggestion, match)
      if (!suggestion || suggestion === original) continue

      results.push({
        start,
        end: start + original.length,
        suggestion,
        message: rule.message,
        category,
        autoFixable: true,
      })
    }
  }

  return results
}

function findRepeatedChars(text: string): TextReplacement[] {
  const results: TextReplacement[] = []
  const pattern = /([\u4e00-\u9fff])\1{1,}/g

  for (const match of text.matchAll(pattern)) {
    const char = match[1]
    const start = match.index ?? 0
    results.push({
      start,
      end: start + match[0].length,
      suggestion: char,
      message: `重复用字「${match[0]}」`,
      category: 'grammar',
      autoFixable: true,
    })
  }

  return results
}

function findTrailingSpaces(text: string): TextReplacement[] {
  const results: TextReplacement[] = []
  const pattern = /[ \t]+$/gm

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    results.push({
      start,
      end: start + match[0].length,
      suggestion: '',
      message: '行尾多余空格',
      category: 'format',
      autoFixable: true,
    })
  }

  return results
}

function mergeNonOverlapping(replacements: TextReplacement[]): TextReplacement[] {
  const sorted = [...replacements].sort((a, b) => a.start - b.start || b.end - a.end)
  const merged: TextReplacement[] = []

  for (const item of sorted) {
    const last = merged[merged.length - 1]
    if (last && item.start < last.end) continue
    merged.push(item)
  }

  return merged
}

export function formatDocument(text: string): string {
  let result = normalizeDocumentStructure(text)
  result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  result = result
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, '').trimEnd())
    .join('\n')

  result = result.replace(/\n{3,}/g, '\n\n')

  const lines = result.split('\n')
  const formattedLines: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i].trim()

    if (!line) {
      if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
        formattedLines.push('')
      }
      continue
    }

    const isTitle =
      i === 0 ||
      (/^第[一二三四五六七八九十\d]+[章节部分]/u.test(line) && line.length <= 30) ||
      (/^[一二三四五六七八九十\d]+[、.．]/u.test(line) && line.length <= 40)

    const isList = /^(\d+[.．、]|[•·\-*]|\([0-9]+\))\s*/u.test(line)

    if (isTitle) {
      line = line.replace(/\s+/g, '')
    } else if (!isList && !line.startsWith('　　')) {
      line = `　　${line.replace(/^[ 　]+/, '')}`
    }

    formattedLines.push(line)
  }

  return formattedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function applyReplacements(text: string, replacements: TextReplacement[]): string {
  const merged = mergeNonOverlapping(replacements.filter((r) => r.autoFixable))
  let result = text
  for (let i = merged.length - 1; i >= 0; i -= 1) {
    const { start, end, suggestion } = merged[i]
    result = result.slice(0, start) + suggestion + result.slice(end)
  }
  return result
}

export function proofreadDocument(text: string, options?: { autoFormat?: boolean }): ProofreadResult {
  issueSeq = 0
  const autoFormat = options?.autoFormat ?? true
  const working = text

  const allReplacements: TextReplacement[] = [
    ...collectRules(working, TYPO_RULES, 'typo'),
    ...collectRules(working, GRAMMAR_RULES, 'grammar'),
    ...collectRules(working, PUNCTUATION_RULES, 'punctuation'),
    ...findRepeatedChars(working),
    ...findTrailingSpaces(working),
  ]

  const merged = mergeNonOverlapping(allReplacements)
  const corrected = applyReplacements(working, merged)
  const formatted = autoFormat ? formatDocument(corrected) : corrected

  const issues: DocumentIssue[] = merged.map((item) => ({
    id: nextIssueId(),
    category: item.category,
    message: item.message,
    start: item.start,
    end: item.end,
    original: working.slice(item.start, item.end),
    suggestion: item.suggestion,
    autoFixable: item.autoFixable,
  }))

  if (autoFormat && formatted !== corrected) {
    issues.push({
      id: nextIssueId(),
      category: 'format',
      message: '已自动排版：段落缩进与空行整理',
      start: 0,
      end: 0,
      original: '',
      suggestion: '',
      autoFixable: true,
    })
  }

  return { issues, formatted }
}

export function applyAllFixes(text: string): { text: string; issues: DocumentIssue[] } {
  const result = proofreadDocument(text, { autoFormat: true })
  return { text: result.formatted, issues: result.issues }
}

export function applyFixableIssues(text: string, issues: DocumentIssue[]): string {
  const fixable = issues.filter((issue) => issue.autoFixable && issue.start !== issue.end && issue.original)
  const resolved = fixable
    .map((issue) => {
      const range = resolveIssueRange(text, issue)
      return range ? { issue, start: range.start, end: range.end } : null
    })
    .filter((item): item is { issue: DocumentIssue; start: number; end: number } => item !== null)
    .sort((a, b) => b.start - a.start)

  let result = text
  for (const { issue, start, end } of resolved) {
    const suggestion = trimDuplicateTrailingPunctuation(result, end, issue.suggestion)
    result = result.slice(0, start) + suggestion + result.slice(end)
  }
  return result
}

export function applySingleFix(text: string, issue: DocumentIssue): string {
  if (!issue.autoFixable || issue.start === issue.end) return text

  const range = resolveIssueRange(text, issue)
  if (!range) return text

  const suggestion = trimDuplicateTrailingPunctuation(text, range.end, issue.suggestion)
  return text.slice(0, range.start) + suggestion + text.slice(range.end)
}

/** 撤销单条采纳：将正文中的 suggestion 还原为 original */
export function revertSingleFix(text: string, issue: DocumentIssue): string {
  if (!issue.autoFixable || issue.start === issue.end) return text

  const revertIssue: DocumentIssue = {
    ...issue,
    original: issue.suggestion,
    suggestion: issue.original,
  }
  const range = resolveIssueRange(text, revertIssue)
  if (!range) return text

  return text.slice(0, range.start) + issue.original + text.slice(range.end)
}

/** 合并多来源问题，去掉重叠区间 */
export function mergeDocumentIssues(issueGroups: DocumentIssue[][]): DocumentIssue[] {
  const flat = issueGroups.flat().sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: DocumentIssue[] = []

  for (const issue of flat) {
    const last = merged[merged.length - 1]
    if (last && issue.start < last.end) continue
    if (shouldSkipProofreadIssue(issue.original, issue.suggestion)) continue
    const duplicate = merged.some(
      (item) =>
        item.start === issue.start &&
        item.end === issue.end &&
        item.original === issue.original &&
        item.suggestion === issue.suggestion,
    )
    if (!duplicate) merged.push(issue)
  }

  return merged
}

export interface FullProofreadResult extends ProofreadResult {
  languageToolIssues: DocumentIssue[]
  languageToolError?: string
}

/** 本地规则校对 + LanguageTool 在线检测 */
export async function proofreadDocumentFull(
  text: string,
  options?: { autoFormat?: boolean; skipLanguageTool?: boolean },
): Promise<FullProofreadResult> {
  const autoFormat = options?.autoFormat ?? true
  const local = proofreadDocument(text, { autoFormat })

  if (options?.skipLanguageTool) {
    return { ...local, languageToolIssues: [] }
  }

  try {
    const { checkWithLanguageTool } = await import('./languageTool')
    const ltIssues = await checkWithLanguageTool(local.formatted)
    return {
      issues: mergeDocumentIssues([local.issues, ltIssues]),
      formatted: local.formatted,
      languageToolIssues: ltIssues,
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'LanguageTool 服务暂时不可用，仅完成本地规则校对'
    return {
      issues: local.issues,
      formatted: local.formatted,
      languageToolIssues: [],
      languageToolError: message,
    }
  }
}

export async function applyAllFixesFull(text: string): Promise<FullProofreadResult> {
  return proofreadDocumentFull(text, { autoFormat: false })
}
