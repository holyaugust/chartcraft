import { describe, expect, it } from 'vitest'
import {
  A4_PAGE_PX,
  a4ContentBoxHeightPx,
  buildOfficialLayoutPages,
  paginateBlockHeights,
  formatA4PageStatus,
} from './documentA4Layout'

describe('documentA4Layout', () => {
  it('defines A4 page metrics in CSS pixels', () => {
    expect(A4_PAGE_PX.width).toBe(794)
    expect(A4_PAGE_PX.height).toBe(1123)
    expect(a4ContentBoxHeightPx()).toBeGreaterThan(800)
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
