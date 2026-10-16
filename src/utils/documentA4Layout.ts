import { buildOfficialLayoutHtml } from './documentOfficialLayout'

/** A4 @96dpi；页边距为屏幕预览用的近似视觉边距（非 GB/T 9704 毫米值） */
export const A4_PAGE_PX = {
  width: 794,
  height: 1123,
  /** 上下边距 */
  paddingY: 72,
  /** 左右边距 */
  paddingX: 68,
} as const

/** CSS padding 简写：上下 | 左右 */
export const A4_PAGE_PADDING_CSS = `${A4_PAGE_PX.paddingY}px ${A4_PAGE_PX.paddingX}px`

export type BuildOfficialLayoutPagesOptions = {
  document?: Document
  /** 测试或自定义测量；默认用 offsetHeight + margin */
  measureHeights?: (container: HTMLElement) => number[]
}

export function a4ContentBoxHeightPx(): number {
  return A4_PAGE_PX.height - A4_PAGE_PX.paddingY * 2
}

/**
 * 将块高度装入多页。不拆分单个块；装不下则换页。
 * 返回每页包含的块下标。
 */
export function paginateBlockHeights(heights: number[], maxHeight: number): number[][] {
  if (heights.length === 0) return [[]]

  const pages: number[][] = [[]]
  let used = 0

  for (let i = 0; i < heights.length; i += 1) {
    const h = Math.max(0, heights[i] ?? 0)
    const page = pages[pages.length - 1]!
    const fits = page.length === 0 || used + h <= maxHeight

    if (fits) {
      page.push(i)
      used += h
      continue
    }

    pages.push([i])
    used = h
  }

  return pages
}

export function formatA4PageStatus(pageIndex1Based: number, pageCount: number): string {
  const safeCount = Math.max(1, pageCount)
  const safeIndex = Math.min(Math.max(1, pageIndex1Based), safeCount)
  return `第 ${safeIndex} 页，共 ${safeCount} 页 · A4`
}

/** 按整页纸高度估算页数（文本编辑用，非块级真分页） */
export function estimateA4PageCount(contentHeightPx: number): number {
  if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0) return 1
  return Math.max(1, Math.ceil(contentHeightPx / A4_PAGE_PX.height))
}

/** 按滚动位置估算当前页（视口上方约 1/3 处） */
export function estimateA4CurrentPage(
  scrollTop: number,
  viewportHeight: number,
  pageCount: number,
): number {
  const safeCount = Math.max(1, pageCount)
  const focusY = Math.max(0, scrollTop) + Math.max(0, viewportHeight) / 3
  const page = Math.floor(focusY / A4_PAGE_PX.height) + 1
  return Math.min(safeCount, Math.max(1, page))
}

/** 将已渲染的块节点按高度装入多张 A4 纸（纸间插入不可编辑页缝） */
export function wrapBlocksIntoA4Sheets(
  blockElements: HTMLElement[],
  heights: number[],
  maxHeight: number = a4ContentBoxHeightPx(),
): DocumentFragment {
  const fragment = document.createDocumentFragment()
  if (blockElements.length === 0) {
    const sheet = document.createElement('div')
    sheet.className = 'document-a4-editor-sheet'
    sheet.setAttribute('data-a4-sheet', '1')
    fragment.append(sheet)
    return fragment
  }

  const groups = paginateBlockHeights(heights, maxHeight)
  groups.forEach((indices, pageIndex) => {
    const sheet = document.createElement('div')
    sheet.className = 'document-a4-editor-sheet'
    sheet.setAttribute('data-a4-sheet', String(pageIndex + 1))
    for (const index of indices) {
      const block = blockElements[index]
      if (block) sheet.append(block)
    }
    fragment.append(sheet)
    if (pageIndex < groups.length - 1) {
      const gap = document.createElement('div')
      gap.className = 'document-a4-editor-gap'
      gap.contentEditable = 'false'
      gap.setAttribute('data-a4-gap', 'true')
      gap.setAttribute('aria-hidden', 'true')
      fragment.append(gap)
    }
  })
  return fragment
}

/** 测量子节点占位高度（含上下 margin） */
export function measureBlockHeights(container: HTMLElement): number[] {
  const children = Array.from(container.children) as HTMLElement[]
  return children.map((el) => {
    const style = window.getComputedStyle(el)
    const mt = Number.parseFloat(style.marginTop) || 0
    const mb = Number.parseFloat(style.marginBottom) || 0
    return el.offsetHeight + mt + mb
  })
}

function applyMeasureInlineStyles(page: HTMLElement) {
  page.style.cssText = [
    `box-sizing:border-box`,
    `width:${A4_PAGE_PX.width}px`,
    `padding:${A4_PAGE_PADDING_CSS}`,
    `background:#fff`,
    `color:#1e293b`,
  ].join(';')

  const style = page.ownerDocument.createElement('style')
  style.setAttribute('data-a4-measure-style', 'true')
  style.textContent = `
    .document-a4-measure .doc-layout-empty {
      margin: 40px 0; text-align: center; color: #94a3b8; font-size: 13px;
    }
    .document-a4-measure .doc-layout-gap { height: 12px; }
    .document-a4-measure .doc-layout-p {
      margin: 0 0 10px; font-size: 15px; line-height: 1.85; color: #1e293b;
      font-family: 'FangSong', '仿宋', 'STFangsong', 'Songti SC', serif;
      text-align: justify;
    }
    .document-a4-measure .doc-layout-title {
      text-align: center;
      font-family: 'STZhongsong', '华文中宋', 'SimSun', '宋体', 'Songti SC', serif;
      font-weight: 700; font-size: 22px; line-height: 1.55;
      text-indent: 0 !important; margin: 12px 0 22px; letter-spacing: 0.04em;
    }
    .document-a4-measure .doc-layout-redHeader,
    .document-a4-measure .doc-layout-enterpriseBanner {
      text-align: center;
      font-family: 'SimHei', '黑体', 'Microsoft YaHei', sans-serif;
      font-weight: 700; font-size: 18px; line-height: 1.6;
      text-indent: 0; margin: 8px 0 18px;
    }
    .document-a4-measure .doc-layout-redHeader { color: #c10000; }
    .document-a4-measure .doc-layout-recipient,
    .document-a4-measure .doc-layout-heading1,
    .document-a4-measure .doc-layout-heading2,
    .document-a4-measure .doc-layout-heading3,
    .document-a4-measure .doc-layout-heading4,
    .document-a4-measure .doc-layout-attachment,
    .document-a4-measure .doc-layout-copyTo,
    .document-a4-measure .doc-layout-closing { text-indent: 0; }
    .document-a4-measure .doc-layout-heading1 {
      font-family: 'SimHei', '黑体', 'Microsoft YaHei', sans-serif;
      font-weight: 700; margin-top: 18px;
    }
    .document-a4-measure .doc-layout-heading2 {
      font-family: 'KaiTi', '楷体', 'STKaiti', serif;
      font-weight: 700; margin-top: 14px;
    }
    .document-a4-measure .doc-layout-heading3,
    .document-a4-measure .doc-layout-heading4 { font-weight: 700; margin-top: 10px; }
    .document-a4-measure .doc-layout-body,
    .document-a4-measure .doc-layout-numberedItem { text-indent: 2em; }
    .document-a4-measure .doc-layout-signatureOrg,
    .document-a4-measure .doc-layout-signatureDate {
      text-align: right; text-indent: 0; margin-left: auto; max-width: 60%;
    }
  `
  page.appendChild(style)
}

/** 将正文按 A4 版心拆成多页 HTML（块级不拆开） */
export function buildOfficialLayoutPages(
  content: string,
  options: BuildOfficialLayoutPagesOptions = {},
): { pagesHtml: string[]; pageCount: number } {
  const doc = options.document ?? document
  const host = doc.createElement('div')
  host.setAttribute('data-document-a4-measure', 'true')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:1;pointer-events:none;z-index:-1;'

  const page = doc.createElement('div')
  page.className = 'document-official-layout-page document-a4-measure'
  applyMeasureInlineStyles(page)

  const contentEl = doc.createElement('div')
  contentEl.className = 'document-a4-page-content'
  contentEl.innerHTML = buildOfficialLayoutHtml(content)
  page.appendChild(contentEl)
  host.appendChild(page)
  doc.body.appendChild(host)

  try {
    const children = Array.from(contentEl.children) as HTMLElement[]
    if (children.length === 0) {
      return { pagesHtml: [''], pageCount: 1 }
    }

    const heights = options.measureHeights?.(contentEl) ?? measureBlockHeights(contentEl)
    const groups = paginateBlockHeights(heights, a4ContentBoxHeightPx())
    const pagesHtml = groups.map((indices) =>
      indices.map((i) => children[i]!.outerHTML).join(''),
    )
    return { pagesHtml, pageCount: Math.max(1, pagesHtml.length) }
  } finally {
    host.remove()
  }
}
