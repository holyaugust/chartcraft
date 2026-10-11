import { describe, expect, it } from 'vitest'
import {
  applyFixableIssues,
  applySingleFix,
  revertSingleFix,
  type DocumentIssue,
} from './documentProofread'
import { refreshIssueRanges, resolveIssueRange } from './documentLocate'

function makeIssue(
  original: string,
  suggestion: string,
  content = original,
): DocumentIssue {
  const start = content.indexOf(original)
  return {
    id: 'issue-1',
    category: 'typo',
    message: 'test',
    start,
    end: start + original.length,
    original,
    suggestion,
    autoFixable: true,
  }
}

function toggleAdopt(content: string, issue: DocumentIssue, rounds: number): string {
  let next = content
  let current = issue
  for (let i = 0; i < rounds; i += 1) {
    next = applySingleFix(next, current)
    current = refreshIssueRanges(next, [current])[0]!
    next = revertSingleFix(next, current)
    current = refreshIssueRanges(next, [current])[0]!
  }
  return next
}

describe('proofread adopt/revert with prefix-style edits', () => {
  it('does not accumulate deleted suffix when toggling adopt repeatedly', () => {
    const original = '特发服务2027年度资本运作计划报告'
    const suggestion = '特发服务2027年度资本运作计划'
    const content = `${original}\n正文`
    const issue = makeIssue(original, suggestion, content)

    const afterThreeToggles = toggleAdopt(content, issue, 3)

    expect(afterThreeToggles).toBe(content)
  })

  it('prefers full original over suggestion prefix when resolving ranges', () => {
    const original = '特发服务2027年度资本运作计划报告'
    const suggestion = '特发服务2027年度资本运作计划'
    const content = `${original}\n正文`
    const issue = makeIssue(original, suggestion, content)
    // Simulate stale short range left after a previous adopt
    const stale: DocumentIssue = {
      ...issue,
      start: 0,
      end: suggestion.length,
    }

    const range = resolveIssueRange(content, stale)

    expect(range).toEqual({ start: 0, end: original.length })
  })

  it('keeps apply a no-op when original text is already gone but does not leave stale prefix traps', () => {
    const original = '年度工作计划报告'
    const suggestion = '年度工作计划'
    let content = `${original}\n正文`
    let issue = makeIssue(original, suggestion, content)

    content = applySingleFix(content, issue)
    issue = refreshIssueRanges(content, [issue])[0]!
    expect(content.startsWith(suggestion)).toBe(true)

    // Second apply should not change text
    const again = applySingleFix(content, issue)
    expect(again).toBe(content)
  })

  it('does not re-insert original when content already has original (failed apply then revert)', () => {
    const original = '实施方案报告'
    const suggestion = '实施方案'
    const content = `${original}\n后文`
    const issue = makeIssue(original, suggestion, content)
    // Stale short range as if refresh thought we were on suggestion
    const stale: DocumentIssue = { ...issue, start: 0, end: suggestion.length }

    const reverted = revertSingleFix(content, stale)

    expect(reverted).toBe(content)
  })

  it('handles suffix deletion without accumulation', () => {
    const original = '报告特发服务年度计划'
    const suggestion = '特发服务年度计划'
    const content = `${original}\n正文`
    const issue = makeIssue(original, suggestion, content)

    expect(toggleAdopt(content, issue, 3)).toBe(content)
  })

  it('handles mid-string replacement without accumulation', () => {
    const original = '完成工作报告起草'
    const suggestion = '完成工作计划起草'
    const content = `${original}\n正文`
    const issue = makeIssue(original, suggestion, content)

    expect(toggleAdopt(content, issue, 3)).toBe(content)
  })

  it('applies multiple pending fixes without prefix traps across items', () => {
    const content = '甲计划报告\n乙方案报告'
    const issues: DocumentIssue[] = [
      makeIssue('甲计划报告', '甲计划', content),
      makeIssue('乙方案报告', '乙方案', content),
    ]

    const applied = applyFixableIssues(content, issues)
    expect(applied).toBe('甲计划\n乙方案')

    let next = applied
    let current = refreshIssueRanges(next, issues)
    for (const issue of current) {
      next = revertSingleFix(next, issue)
    }
    current = refreshIssueRanges(next, current)
    expect(next).toBe(content)

    next = applyFixableIssues(next, current)
    expect(next).toBe('甲计划\n乙方案')
  })
})
