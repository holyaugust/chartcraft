import { describe, expect, it } from 'vitest'
import { isStaleProofreadIssue, mergeProofreadIssues, type DocumentIssue } from './documentProofread'
import { collectStructuralProofreadIssues } from './documentStructureProofread'

function issue(partial: Partial<DocumentIssue> & Pick<DocumentIssue, 'original' | 'suggestion'>): DocumentIssue {
  const content = partial.original
  const start = partial.start ?? 0
  const end = partial.end ?? start + content.length
  return {
    id: partial.id ?? 'issue-1',
    category: partial.category ?? 'format',
    message: partial.message ?? '层级',
    start,
    end,
    original: partial.original,
    suggestion: partial.suggestion,
    autoFixable: partial.autoFixable ?? true,
  }
}

describe('heading proofread guards', () => {
  it('drops suggestions whose claimed original is no longer in the document', () => {
    const text = '（二）主要方向\n（一）IFM服务主业类标的。\n（二）科技赋能类标的。'
    const stale = issue({
      original: '一、IFM服务主业类标的',
      suggestion: '（一）IFM服务主业类标的。',
      start: 0,
      end: '一、IFM服务主业类标的'.length,
    })
    expect(isStaleProofreadIssue(text, stale)).toBe(true)
    expect(mergeProofreadIssues(text, [stale])).toEqual([])
  })

  it('drops suggestions that would rewrite the current heading into itself', () => {
    const text = '（一）IFM服务主业类标的。\n正文'
    const noOp = issue({
      original: '（一）IFM服务主业类标的。',
      suggestion: '（一）IFM服务主业类标的。',
      start: 0,
      end: '（一）IFM服务主业类标的。'.length,
    })
    expect(isStaleProofreadIssue(text, noOp)).toBe(true)
  })

  it('flags disordered second-level numbering after （二） comes （一）', () => {
    const text = [
      '（二）主要方向与运作方式',
      '（一）IFM服务主业类标的。',
      '围绕IFM服务主业开展并购。',
      '（二）科技赋能与专业运维类标的。',
    ].join('\n')
    const issues = collectStructuralProofreadIssues(text)
    const hit = issues.find((item) => item.message.includes('序号顺序'))
    expect(hit).toBeTruthy()
    expect(text.slice(hit!.start, hit!.end)).toContain('（一）IFM服务主业类标的')
  })

  it('flags standalone numbered headings that end with a full stop', () => {
    const text = [
      '一、总体思路。',
      '正文一段。',
      '（一）IFM服务主业类标的。',
      '围绕IFM服务主业开展并购。',
      '1. 短期安排。',
    ].join('\n')
    const issues = collectStructuralProofreadIssues(text)
    const hits = issues.filter((item) => item.message.includes('标题末尾不宜使用句号'))
    expect(hits).toHaveLength(3)
    expect(hits.map((item) => item.suggestion)).toEqual([
      '一、总体思路',
      '（一）IFM服务主业类标的',
      '1. 短期安排',
    ])
    expect(hits.every((item) => item.autoFixable)).toBe(true)
  })

  it('does not flag body sentences that merely end with a full stop', () => {
    const text = '围绕IFM服务主业开展并购。\n公司将持续加大投入。'
    const issues = collectStructuralProofreadIssues(text)
    expect(issues.some((item) => item.message.includes('标题末尾不宜使用句号'))).toBe(false)
  })
})
