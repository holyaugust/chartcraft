import { describe, expect, it } from 'vitest'
import { detectHeadingLevel } from './documentFormatNormalize'
import {
  applyPageCommand,
  locatePageOffset,
  parseDocumentPage,
  serializeDocumentPage,
} from './documentPageBlocks'

const sample = '普通段落\n\n一、总则\n（一）范围\n1. 条目\n（1）细目\n\u3000已有缩进\n甲 |  乙 \n丙 | 丁 | 戊\n附件：说明\n'

describe('document page blocks', () => {
  it('exports the existing heading levels', () => {
    expect(detectHeadingLevel('一、总则')).toBe('h1')
    expect(detectHeadingLevel('二、2027年资本运作总体思路和主要方向')).toBe('h1')
    expect(detectHeadingLevel('（一）范围')).toBe('h2')
    expect(detectHeadingLevel('1. 条目')).toBe('h3')
    expect(detectHeadingLevel('（1）细目')).toBe('h4')
    expect(detectHeadingLevel('普通')).toBeNull()
  })

  it('treats a short first line without end punctuation as a centered title', () => {
    const blocks = parseDocumentPage('保密承诺函\n一、保密信息定义')
    expect(blocks[0]).toMatchObject({ kind: 'title', text: '保密承诺函' })
    expect(blocks[1]).toMatchObject({ kind: 'heading', level: 'h1' })
  })

  it('does not treat a first sentence as a title', () => {
    const blocks = parseDocumentPage('这是一句完整的话。\n下一行')
    expect(blocks[0]).toMatchObject({ kind: 'paragraph' })
  })

  it('skips blank lines before the leading title', () => {
    const blocks = parseDocumentPage('\n\n保密承诺函\n正文')
    expect(blocks[2]).toMatchObject({ kind: 'title', text: '保密承诺函' })
  })

  it('right-aligns 落款 lines and keeps a sentence about 甲方 as body', () => {
    const blocks = parseDocumentPage(
      '保密承诺函\n甲方应在十日内付款。\n承诺方：深圳市特发服务股份有限公司（盖章）\n日期： 年 月 日',
    )
    expect(blocks[1]).toMatchObject({ kind: 'paragraph', text: '甲方应在十日内付款。' })
    expect(blocks[2]).toMatchObject({
      kind: 'signature',
      text: '承诺方：深圳市特发服务股份有限公司（盖章）',
    })
    expect(blocks[3]).toMatchObject({ kind: 'signature', text: '日期： 年 月 日' })
  })

  it('keeps 结语 like 特此承诺 as body', () => {
    const blocks = parseDocumentPage('正文\n特此承诺！\n承诺方：某某公司（盖章）')
    expect(blocks[1]).toMatchObject({ kind: 'paragraph', text: '特此承诺！' })
    expect(blocks[2]).toMatchObject({ kind: 'signature', text: '承诺方：某某公司（盖章）' })
  })

  it('keeps 致：主送机关 as body, not 落款', () => {
    const blocks = parseDocumentPage(
      '保密承诺函\n致：广东贝润教育投资有限公司\n鉴于深圳市特发服务股份有限公司（以下简称“我方”）与贵方协商一致。',
    )
    expect(blocks[1]).toMatchObject({
      kind: 'addressee',
      text: '致：广东贝润教育投资有限公司',
    })
    expect(blocks[2]).toMatchObject({ kind: 'paragraph' })
  })

  it('round-trips paragraphs, blanks, headings, cell spaces, ragged rows, and a trailing newline', () => {
    expect(serializeDocumentPage(parseDocumentPage(sample))).toBe(sample)
  })

  it('keeps a space-only line as a paragraph', () => {
    const text = ' \n甲'
    const blocks = parseDocumentPage(text)
    expect(blocks[0]).toMatchObject({ kind: 'paragraph', text: ' ' })
    expect(serializeDocumentPage(blocks)).toBe(text)
  })

  it('treats a separator line as a table even when the trimmed line looks like a heading', () => {
    const blocks = parseDocumentPage('一、标题 | 不是标题')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      kind: 'table',
      rows: [{ cells: [{ text: '一、标题' }, { text: '不是标题' }] }],
    })
  })

  it('keeps leading spaces on a heading line', () => {
    const blocks = parseDocumentPage('  一、总则')
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 'h1', text: '  一、总则' })
  })

  it('maps a cell offset and an offset past the newline', () => {
    const text = '甲 | 乙\n丙'
    expect(locatePageOffset(text, 4)).toMatchObject({
      blockIndex: 0,
      rowIndex: 0,
      cellIndex: 1,
      offsetInCell: 0,
    })
    expect(locatePageOffset(text, 5)).toMatchObject({
      blockIndex: 0,
      offsetInBlock: 5,
      rowIndex: null,
      cellIndex: null,
    })
    expect(locatePageOffset(text, 6)).toMatchObject({
      blockIndex: 1,
      offsetInBlock: 0,
      rowIndex: null,
    })
    expect(text.slice(4, 7)).toBe('乙\n丙')
  })

  it('splits a paragraph on enter and also splits after deleting a selection', () => {
    expect(applyPageCommand('甲乙丙', { start: 1, end: 1 }, 'enter')).toEqual({
      text: '甲\n乙丙',
      caret: { start: 2, end: 2 },
    })
    expect(applyPageCommand('甲乙丙丁', { start: 1, end: 3 }, 'enter')).toEqual({
      text: '甲\n丁',
      caret: { start: 2, end: 2 },
    })
  })

  it('merges into the previous line unless that line is a table', () => {
    expect(applyPageCommand('甲\n乙', { start: 2, end: 2 }, 'backspace')).toEqual({
      text: '甲乙',
      caret: { start: 1, end: 1 },
    })
    expect(applyPageCommand('甲 | 乙\n丙', { start: 6, end: 6 }, 'backspace').text).toBe('甲 | 乙\n丙')
  })

  it('deletes the selection and then one more character on backspace', () => {
    expect(applyPageCommand('甲乙丙', { start: 1, end: 2 }, 'backspace')).toEqual({
      text: '丙',
      caret: { start: 0, end: 0 },
    })
  })

  it('joins the next line on delete unless the next line is a table', () => {
    expect(applyPageCommand('甲\n乙', { start: 1, end: 1 }, 'delete')).toEqual({
      text: '甲乙',
      caret: { start: 1, end: 1 },
    })
    expect(applyPageCommand('甲\n乙 | 丙', { start: 1, end: 1 }, 'delete').text).toBe('甲\n乙 | 丙')
  })

  it('replaces one cell and splits a cell when the separator is inserted', () => {
    expect(applyPageCommand('甲 | 乙\n丙 | 丁', { start: 0, end: 1 }, 'insertText', '戊').text).toBe(
      '戊 | 乙\n丙 | 丁',
    )
    const inserted = applyPageCommand('甲 | 乙', { start: 1, end: 1 }, 'insertText', ' | ')
    expect(inserted.text).toBe('甲 |  | 乙')
    expect(parseDocumentPage(inserted.text)[0]).toMatchObject({
      kind: 'table',
      rows: [{ cells: [{ text: '甲' }, { text: '' }, { text: '乙' }] }],
    })
  })

  it('leaves an empty line when the last character of that line is deleted', () => {
    expect(applyPageCommand('前\n甲', { start: 3, end: 3 }, 'backspace')).toEqual({
      text: '前\n',
      caret: { start: 2, end: 2 },
    })
  })

  it('inserts an empty row of the same width on enter and on tab in the last cell', () => {
    expect(applyPageCommand('甲 | 乙 | 丙', { start: 0, end: 0 }, 'enter')).toEqual({
      text: '甲 | 乙 | 丙\n |  | ',
      caret: { start: 10, end: 10 },
    })
    expect(applyPageCommand('甲 | 乙', { start: 4, end: 4 }, 'tab')).toEqual({
      text: '甲 | 乙\n | ',
      caret: { start: 6, end: 6 },
    })
  })

  it('moves tab to the next cell without deleting a selection', () => {
    expect(applyPageCommand('甲 | 乙\n丙 | 丁', { start: 0, end: 1 }, 'tab')).toEqual({
      text: '甲 | 乙\n丙 | 丁',
      caret: { start: 4, end: 4 },
    })
    expect(applyPageCommand('甲 | 乙\n丙 | 丁', { start: 4, end: 4 }, 'tab').caret).toEqual({
      start: 6,
      end: 6,
    })
  })

  it('does not eat a separator from an empty cell unless the whole row is empty', () => {
    expect(applyPageCommand('甲 | ', { start: 4, end: 4 }, 'backspace').text).toBe('甲 | ')
    expect(applyPageCommand('甲 | 乙\n | ', { start: 6, end: 6 }, 'backspace').text).toBe('甲 | 乙')
    expect(applyPageCommand('前文\n | \n后文', { start: 3, end: 3 }, 'backspace').text).toBe('前文\n\n后文')
    expect(applyPageCommand(' | ', { start: 0, end: 0 }, 'backspace')).toEqual({
      text: '',
      caret: { start: 0, end: 0 },
    })
  })
})
