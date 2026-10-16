import { describe, expect, it } from 'vitest'
import {
  A4_PAGE_PX,
  a4ContentBoxHeightPx,
  buildOfficialLayoutPages,
  estimateA4CurrentPage,
  estimateA4PageCount,
  paginateBlockHeights,
  formatA4PageStatus,
  wrapBlocksIntoA4Sheets,
} from './documentA4Layout'

describe('documentA4Layout', () => {
  it('defines A4 page metrics in CSS pixels', () => {
    expect(A4_PAGE_PX.width).toBe(794)
    expect(A4_PAGE_PX.height).toBe(1123)
    expect(A4_PAGE_PX.paddingY).toBe(72)
    expect(A4_PAGE_PX.paddingX).toBe(68)
    expect(a4ContentBoxHeightPx()).toBe(A4_PAGE_PX.height - A4_PAGE_PX.paddingY * 2)
    expect(a4ContentBoxHeightPx()).toBeLessThan(A4_PAGE_PX.height)
  })

  it('packs block heights into pages without overflowing the content box', () => {
    const maxH = 100
    const pages = paginateBlockHeights([40, 40, 40, 30], maxH)
    expect(pages).toEqual([[0, 1], [2, 3]])
  })

  it('moves an oversized trailing block to the next page when it still fits alone', () => {
    const pages = paginateBlockHeights([60, 50], 100)
    expect(pages).toEqual([[0], [1]])
  })

  it('keeps a single block that exceeds the page on its own page', () => {
    const pages = paginateBlockHeights([150, 20], 100)
    expect(pages).toEqual([[0], [1]])
  })

  it('formats Word-like status text', () => {
    expect(formatA4PageStatus(1, 3)).toBe('第 1 页，共 3 页 · A4')
    expect(formatA4PageStatus(2, 2)).toBe('第 2 页，共 2 页 · A4')
  })

  it('estimates page count from content height', () => {
    expect(estimateA4PageCount(0)).toBe(1)
    expect(estimateA4PageCount(A4_PAGE_PX.height)).toBe(1)
    expect(estimateA4PageCount(A4_PAGE_PX.height + 1)).toBe(2)
    expect(estimateA4CurrentPage(0, 400, 2)).toBe(1)
    expect(estimateA4CurrentPage(A4_PAGE_PX.height + 20, 400, 3)).toBe(2)
  })

  it('wraps block elements into multiple A4 editor sheets', () => {
    const host = document.createElement('div')
    const blocks = [0, 1, 2, 3].map((i) => {
      const el = document.createElement('p')
      el.textContent = `块${i}`
      el.dataset.plainStart = String(i)
      host.append(el)
      return el
    })
    const fragment = wrapBlocksIntoA4Sheets(blocks, [400, 400, 400, 400])
    const wrap = document.createElement('div')
    wrap.append(fragment)
    expect(wrap.querySelectorAll('.document-a4-editor-sheet')).toHaveLength(2)
    expect(wrap.querySelectorAll('.document-a4-editor-gap')).toHaveLength(1)
    expect(wrap.querySelectorAll('.document-a4-editor-sheet')[0]?.textContent).toContain('块0')
    expect(wrap.querySelectorAll('.document-a4-editor-sheet')[1]?.textContent).toContain('块2')
  })

  it('builds multiple official-layout page html fragments from measured heights', () => {
    const sample = '标题一行\n\n一、总体思路\n正文一段。\n二、计划\n更多正文。'
    const { pagesHtml, pageCount } = buildOfficialLayoutPages(sample, {
      measureHeights: (container) => Array.from(container.children).map(() => 400),
    })
    expect(pageCount).toBeGreaterThan(1)
    expect(pagesHtml).toHaveLength(pageCount)
    expect(pagesHtml.every((html) => html.includes('doc-layout'))).toBe(true)
  })
})
