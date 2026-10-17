import { describe, expect, it } from 'vitest'
import { applyRevisionHunks, buildFormatRevisionHunks, locateFormatIssue } from './documentFormatDiff'
import type { FormatFixItem } from './documentFormatAdjust'

describe('documentFormatDiff', () => {
  it('turns removed blank lines into a deletion hunk that reproduces the formatted text', () => {
    const before = '标题\n\n\n正文'
    const after = '标题\n\n正文'
    const hunks = buildFormatRevisionHunks(before, after)
    expect(hunks.length).toBeGreaterThan(0)
    expect(applyRevisionHunks(before, hunks)).toBe(after)
    expect(hunks.some((hunk) => hunk.end > hunk.start && hunk.replacement === '')).toBe(true)
  })

  it('turns a heading rewrite into a visible replacement hunk', () => {
    const before = '1、概况\n正文'
    const after = '一、概况\n正文'
    const hunks = buildFormatRevisionHunks(before, after)
    expect(applyRevisionHunks(before, hunks)).toBe(after)
    expect(hunks[0]?.replacement.startsWith('一、概况')).toBe(true)
    expect(before.slice(hunks[0]!.start, hunks[0]!.end)).toContain('1、概况')
  })

  it('locates blank lines and arabic headings in the current text', () => {
    const blank = locateFormatIssue('标题\n\n\n正文', item('blank_lines'))
    expect(blank).not.toBeNull()
    expect('标题\n\n\n正文'.slice(blank!.start, blank!.end)).toMatch(/\n/)

    const heading = locateFormatIssue('1、概况\n2、计划\n正文', item('advisory'))
    expect(heading).not.toBeNull()
    expect('1、概况\n2、计划\n正文'.slice(heading!.start, heading!.end)).toContain('1、概况')
  })
})

function item(kind: FormatFixItem['kind']): FormatFixItem {
  return {
    id: kind,
    kind,
    title: kind,
    detail:
      kind === 'advisory'
        ? '有 2 处一级层次使用了阿拉伯数字序号，GB/T 9704 建议一级用「一、」'
        : '合并空行',
    autoApply: kind !== 'advisory',
  }
}
