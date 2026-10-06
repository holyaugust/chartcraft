import { describe, expect, it } from 'vitest'
import { detectHeadingLevel } from './documentFormatNormalize'
import { locatePageOffset, parseDocumentPage, serializeDocumentPage } from './documentPageBlocks'

const sample = '普通段落\n\n一、总则\n（一）范围\n1. 条目\n（1）细目\n\u3000已有缩进\n甲 |  乙 \n丙 | 丁 | 戊\n附件：说明\n'

describe('document page blocks', () => {
  it('exports the existing heading levels', () => {
    expect(detectHeadingLevel('一、总则')).toBe('h1')
    expect(detectHeadingLevel('（一）范围')).toBe('h2')
    expect(detectHeadingLevel('1. 条目')).toBe('h3')
    expect(detectHeadingLevel('（1）细目')).toBe('h4')
    expect(detectHeadingLevel('普通')).toBeNull()
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
})
