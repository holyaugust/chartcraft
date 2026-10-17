import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { TextHighlightRange } from '../utils/documentLocate'
import { scrollPageToRange } from '../utils/documentLocate'
import {
  A4_PAGE_PADDING_CSS,
  A4_PAGE_PX,
  a4ContentBoxHeightPx,
  formatA4PageStatus,
  measureBlockHeights,
  wrapBlocksIntoA4Sheets,
} from '../utils/documentA4Layout'
import {
  applyPageCommand,
  parseDocumentPage,
  type DocumentPageBlock,
  type PageCaret,
  type PageCommand,
} from '../utils/documentPageBlocks'
import { classifyOfficialLines, type OfficialParagraphKind } from '../utils/docxFormattedExport'

export interface DocumentEditorSelectionRect {
  top: number
  left: number
  bottom: number
  width: number
  height: number
}

export interface DocumentEditorSelection {
  start: number
  end: number
  text: string
  rect: DocumentEditorSelectionRect | null
}

/** 结构优化等：在正文中以修订样式预览，不改正文直到确认 */
export interface DocumentRevisionPreview {
  start: number
  end: number
  replacement: string
}

interface DocumentTextEditorProps {
  value: string
  onChange: (value: string) => void
  highlightRange?: TextHighlightRange | null
  aiHighlightRanges?: TextHighlightRange[]
  revisionPreview?: DocumentRevisionPreview | null
  revisionPreviews?: DocumentRevisionPreview[]
  className?: string
  placeholder?: string
  layoutMode?: 'manuscript' | 'official'
  onSelectionChange?: (selection: DocumentEditorSelection | null) => void
}

export interface DocumentPageEditorHandle {
  getPlainSelection(): { start: number; end: number; text: string } | null
  selectRange(start: number, end: number): void
  scrollToRange(start: number, end: number): void
  scrollToTop(): void
}

type MarkVariant = 'plain' | 'pending' | 'adopted' | 'ai' | 'revision-del'

const OWN_INDENT = /^[ \t\u3000]/u

function appendRevisionInsertion(parent: HTMLElement, replacement: string) {
  parent.append(document.createElement('br'))
  const mark = document.createElement('ins')
  mark.className = 'document-revision-ins'
  mark.textContent = replacement
  parent.append(mark)
}

const PageSurface = memo(function PageSurface({
  surfaceRef,
  layoutMode,
}: {
  surfaceRef: RefObject<HTMLDivElement | null>
  layoutMode: 'manuscript' | 'official'
}) {
  return (
    <div
      ref={surfaceRef}
      className={`document-page document-page-a4 document-page-editor${layoutMode === 'official' ? ' document-page-editor-official' : ''}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
    />
  )
})

export function plainOffsetFromNode(root: HTMLElement, node: Node, offset: number): number | null {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement
  const marked = element?.closest<HTMLElement>('[data-plain-start]')
  if (!marked || !root.contains(marked)) return null
  const start = Number(marked.getAttribute('data-plain-start'))
  if (!Number.isFinite(start)) return null
  if (node.nodeType === Node.ELEMENT_NODE) {
    const children = (node as HTMLElement).childNodes
    let extra = 0
    const count = Math.min(offset, children.length)
    for (let index = 0; index < count; index += 1) {
      extra += children[index]?.textContent?.length ?? 0
    }
    return start + extra
  }

  const walker = document.createTreeWalker(marked, NodeFilter.SHOW_TEXT)
  let extra = 0
  let current = walker.nextNode()
  while (current && current !== node) {
    extra += current.textContent?.length ?? 0
    current = walker.nextNode()
  }
  return start + extra + offset
}

function overlappingRevision(
  revisions: DocumentRevisionPreview[],
  absStart: number,
  absEnd: number,
): DocumentRevisionPreview | null {
  return (
    revisions.find((revision) => revision.start < absEnd && revision.end > absStart && revision.end > revision.start) ??
    null
  )
}

function sliceVariant(
  absStart: number,
  absEnd: number,
  highlightRange: TextHighlightRange | null,
  aiHighlightRanges: TextHighlightRange[],
  revisions: DocumentRevisionPreview[],
): MarkVariant {
  if (overlappingRevision(revisions, absStart, absEnd)) {
    return 'revision-del'
  }
  if (highlightRange && highlightRange.start < absEnd && highlightRange.end > absStart) {
    return highlightRange.adopted ? 'adopted' : 'pending'
  }
  const ai = aiHighlightRanges.find((range) => range.start < absEnd && range.end > absStart)
  if (!ai) return 'plain'
  return ai.adopted ? 'adopted' : 'ai'
}

function appendMarked(
  parent: HTMLElement,
  text: string,
  absStart: number,
  highlightRange: TextHighlightRange | null,
  aiHighlightRanges: TextHighlightRange[],
  revisions: DocumentRevisionPreview[] = [],
) {
  if (!text) {
    parent.append(document.createElement('br'))
    return
  }
  const absEnd = absStart + text.length
  const cuts = new Set<number>([absStart, absEnd])
  const consider = [highlightRange, ...aiHighlightRanges].filter(
    (range): range is TextHighlightRange => !!range && range.end > range.start,
  )
  for (const range of consider) {
    cuts.add(Math.max(absStart, Math.min(range.start, absEnd)))
    cuts.add(Math.max(absStart, Math.min(range.end, absEnd)))
  }
  for (const revision of revisions) {
    if (revision.end <= revision.start) continue
    cuts.add(Math.max(absStart, Math.min(revision.start, absEnd)))
    cuts.add(Math.max(absStart, Math.min(revision.end, absEnd)))
  }
  const points = [...cuts].sort((a, b) => a - b)
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index] ?? absStart
    const end = points[index + 1] ?? start
    if (end <= start) continue
    const slice = text.slice(start - absStart, end - absStart)
    const variant = sliceVariant(
      start,
      end,
      highlightRange,
      aiHighlightRanges,
      revisions,
    )
    if (variant === 'plain') {
      parent.append(document.createTextNode(slice))
    } else if (variant === 'revision-del') {
      const mark = document.createElement('del')
      mark.className = 'document-revision-del'
      mark.dataset.plainStart = String(start)
      mark.textContent = slice
      parent.append(mark)
    } else {
      const mark = document.createElement('mark')
      mark.className =
        variant === 'ai' ? 'document-ai-write-highlight' : `document-issue-highlight ${variant}`
      mark.textContent = slice
      parent.append(mark)
    }
    const ended = revisions.find(
      (revision) =>
        revision.replacement &&
        end === revision.end &&
        revision.end > revision.start &&
        end > absStart &&
        end <= absEnd,
    )
    if (ended) appendRevisionInsertion(parent, ended.replacement)
  }
}

function officialClassName(kind: OfficialParagraphKind, text: string): string {
  const ownIndent = kind === 'body' && OWN_INDENT.test(text) ? ' document-page-own-indent' : ''
  return `doc-layout-p doc-layout-${kind}${ownIndent}`
}

function createBlock(
  block: DocumentPageBlock,
  highlightRange: TextHighlightRange | null,
  aiHighlightRanges: TextHighlightRange[],
  officialKind?: OfficialParagraphKind,
  revisions: DocumentRevisionPreview[] = [],
): HTMLElement {
  if (block.kind === 'blank') {
    const gap = document.createElement('div')
    const struck = revisions.some(
      (revision) => revision.end > revision.start && revision.start < block.end + 1 && revision.end > block.start,
    )
    gap.className = struck ? 'document-page-gap document-revision-del' : 'document-page-gap'
    gap.dataset.plainStart = String(block.start)
    gap.dataset.plainEnd = String(block.end)
    gap.append(document.createElement('br'))
    const ended = revisions.find(
      (revision) =>
        revision.replacement &&
        revision.end > revision.start &&
        revision.end > block.start &&
        revision.end <= block.end,
    )
    if (ended) appendRevisionInsertion(gap, ended.replacement)
    return gap
  }
  if (block.kind === 'table') {
    const table = document.createElement('table')
    table.className = 'document-page-table'
    const body = document.createElement('tbody')
    for (const row of block.rows) {
      const tr = document.createElement('tr')
      for (const cell of row.cells) {
        const td = document.createElement('td')
        td.dataset.plainStart = String(cell.start)
        td.dataset.plainEnd = String(cell.end)
        appendMarked(
          td,
          cell.text,
          cell.start,
          highlightRange,
          aiHighlightRanges,
          revisions,
        )
        tr.append(td)
      }
      body.append(tr)
    }
    table.append(body)
    return table
  }
  const paragraph = document.createElement('p')
  if (officialKind && officialKind !== 'skip') {
    paragraph.className = officialClassName(officialKind, block.text)
    if (block.kind === 'heading') paragraph.dataset.level = block.level
  } else if (block.kind === 'title') {
    paragraph.className = 'document-page-title'
  } else if (block.kind === 'addressee') {
    paragraph.className = 'document-page-addressee'
  } else if (block.kind === 'signature') {
    paragraph.className = 'document-page-signature'
  } else if (block.kind === 'heading') {
    paragraph.className = 'document-page-heading'
    paragraph.dataset.level = block.level
  } else {
    paragraph.className = `document-page-body${OWN_INDENT.test(block.text) ? ' document-page-own-indent' : ''}`
  }
  paragraph.dataset.plainStart = String(block.start)
  paragraph.dataset.plainEnd = String(block.end)
  appendMarked(
    paragraph,
    block.text,
    block.start,
    highlightRange,
    aiHighlightRanges,
    revisions,
  )
  return paragraph
}

function paintPage(
  root: HTMLElement,
  value: string,
  highlightRange: TextHighlightRange | null,
  aiHighlightRanges: TextHighlightRange[],
  layoutMode: 'manuscript' | 'official' = 'manuscript',
  revisions: DocumentRevisionPreview[] = [],
) {
  const blocks = parseDocumentPage(value)
  const officialKinds =
    layoutMode === 'official'
      ? classifyOfficialLines(blocks.map((block) => ('text' in block ? block.text : '')))
      : null

  const measure = document.createElement('div')
  measure.className =
    layoutMode === 'official'
      ? 'document-page-editor document-page-editor-official document-a4-editor-measure'
      : 'document-page-editor document-a4-editor-measure'
  measure.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'visibility:hidden',
    'pointer-events:none',
    `width:${A4_PAGE_PX.width}px`,
    `padding:${A4_PAGE_PADDING_CSS}`,
    'box-sizing:border-box',
  ].join(';')

  const blockElements: HTMLElement[] = []
  blocks.forEach((block, index) => {
    let officialKind: OfficialParagraphKind | undefined
    if (officialKinds && block.kind !== 'blank' && block.kind !== 'table') {
      officialKind = officialKinds[index]
    }
    const el = createBlock(block, highlightRange, aiHighlightRanges, officialKind, revisions)
    blockElements.push(el)
    measure.append(el)
  })

  document.body.append(measure)
  let heights = measureBlockHeights(measure)
  // jsdom 等环境高度为 0 时，用版心估算，保证长文仍能拆成多页纸
  if (heights.length > 0 && heights.every((h) => h <= 0)) {
    const approx = Math.max(28, Math.floor(a4ContentBoxHeightPx() / 3))
    heights = heights.map(() => approx)
  }
  const sheets = wrapBlocksIntoA4Sheets(blockElements, heights)
  measure.remove()

  root.replaceChildren(sheets)
  root.contentEditable = revisions.some((revision) => revision.end > revision.start || revision.replacement) ? 'false' : 'true'
}

function blockAt(root: HTMLElement, offset: number): HTMLElement | null {
  const nodes = [...root.querySelectorAll<HTMLElement>('[data-plain-start]')]
  let best: HTMLElement | null = null
  let bestSpan = Number.POSITIVE_INFINITY
  for (const element of nodes) {
    const start = Number(element.dataset.plainStart)
    const end = Number(element.dataset.plainEnd)
    const span = end - start
    if (offset >= start && offset <= end && span < bestSpan) {
      best = element
      bestSpan = span
    }
  }
  return best
}

function setRangeBoundary(
  range: Range,
  root: HTMLElement,
  offset: number,
  edge: 'start' | 'end',
) {
  const target = blockAt(root, offset)
  if (!target) return false
  const local = offset - Number(target.dataset.plainStart)
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
  let remaining = local
  let node = walker.nextNode()
  if (!node) {
    if (edge === 'start') range.setStart(target, 0)
    else range.setEnd(target, 0)
    return true
  }
  while (node) {
    const length = node.textContent?.length ?? 0
    const next = walker.nextNode()
    if (remaining <= length || !next) {
      const point = Math.min(remaining, length)
      if (edge === 'start') range.setStart(node, point)
      else range.setEnd(node, point)
      return true
    }
    remaining -= length
    node = next
  }
  return false
}

function placeCaret(root: HTMLElement, offset: number) {
  const selection = document.getSelection()
  if (!selection) return
  const range = document.createRange()
  if (!setRangeBoundary(range, root, offset, 'start')) return
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function placeSelectionRange(root: HTMLElement, start: number, end: number) {
  const selection = document.getSelection()
  if (!selection) return
  const from = Math.min(start, end)
  const to = Math.max(start, end)
  const range = document.createRange()
  if (!setRangeBoundary(range, root, from, 'start')) return
  if (!setRangeBoundary(range, root, to, 'end')) return
  selection.removeAllRanges()
  selection.addRange(range)
}

function readCaret(root: HTMLElement): PageCaret {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return { start: 0, end: 0 }
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return { start: 0, end: 0 }
  }
  const start = plainOffsetFromNode(root, range.startContainer, range.startOffset)
  const end = plainOffsetFromNode(root, range.endContainer, range.endOffset)
  if (start == null || end == null) return { start: 0, end: 0 }
  return { start, end }
}

function readSelectionRect(root: HTMLElement): DocumentEditorSelectionRect | null {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const rect = range.getBoundingClientRect()
  if (!rect.width && !rect.height) return null
  return {
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  }
}

const DocumentTextEditor = forwardRef<DocumentPageEditorHandle, DocumentTextEditorProps>(
  function DocumentTextEditor(
    {
      value,
      onChange,
      highlightRange = null,
      aiHighlightRanges = [],
      revisionPreview = null,
      revisionPreviews = [],
      className = '',
      placeholder: _placeholder,
      layoutMode = 'manuscript',
      onSelectionChange,
    },
    ref,
  ) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const pageRef = useRef<HTMLDivElement>(null)
    const [pageStatus, setPageStatus] = useState(() => formatA4PageStatus(1, 1))
    const textRef = useRef(value)
    const emittedRef = useRef<string | null>(null)
    const composingRef = useRef(false)
    const onChangeRef = useRef(onChange)
    const highlightRef = useRef(highlightRange)
    const aiRef = useRef(aiHighlightRanges)
    const revisionRef = useRef<DocumentRevisionPreview[]>([])
    const selectionRef = useRef(onSelectionChange)
    const highlightKeyRef = useRef('')
    const layoutModeRef = useRef(layoutMode)
    const caretRef = useRef<PageCaret | null>(null)
    const caretAtComposeRef = useRef<PageCaret>({ start: 0, end: 0 })
    const lastSelectionRef = useRef<{ start: number; end: number; text: string } | null>(null)
    const revisionList = [
      ...(revisionPreview ? [revisionPreview] : []),
      ...revisionPreviews,
    ]
    const highlightKey = `${highlightRange?.start ?? ''}:${highlightRange?.end ?? ''}:${highlightRange?.adopted ?? ''}|${aiHighlightRanges.map((range) => `${range.start}:${range.end}:${range.adopted ?? ''}`).join(',')}|rev:${revisionList.map((revision) => `${revision.start}:${revision.end}:${revision.replacement}`).join(';')}`
    onChangeRef.current = onChange
    highlightRef.current = highlightRange
    aiRef.current = aiHighlightRanges
    revisionRef.current = revisionList
    selectionRef.current = onSelectionChange

    const paintCurrent = (next: string) => {
      const page = pageRef.current
      if (!page) return
      paintPage(
        page,
        next,
        highlightRef.current,
        aiRef.current,
        layoutMode,
        revisionRef.current,
      )
      textRef.current = next
      emittedRef.current = next
      highlightKeyRef.current = highlightKey
      layoutModeRef.current = layoutMode
    }

    const refreshPageStatus = () => {
      const scroller = scrollRef.current
      const page = pageRef.current
      if (!scroller || !page) return
      const sheets = [...page.querySelectorAll<HTMLElement>('.document-a4-editor-sheet')]
      const pageCount = Math.max(1, sheets.length)
      if (sheets.length === 0) {
        setPageStatus(formatA4PageStatus(1, 1))
        return
      }
      const mid = scroller.scrollTop + scroller.clientHeight / 3
      let best = 0
      let bestDist = Number.POSITIVE_INFINITY
      sheets.forEach((sheet, index) => {
        const top = sheet.offsetTop
        const center = top + sheet.offsetHeight / 2
        const dist = Math.abs(center - mid)
        if (dist < bestDist) {
          bestDist = dist
          best = index
        }
      })
      setPageStatus(formatA4PageStatus(best + 1, pageCount))
    }

    useLayoutEffect(() => {
      if (composingRef.current) return
      if (
        emittedRef.current === value &&
        highlightKeyRef.current === highlightKey &&
        layoutModeRef.current === layoutMode
      ) {
        return
      }
      const page = pageRef.current
      const highlightOnly = emittedRef.current === value
      if (highlightOnly && page) {
        const anchor = document.getSelection()?.anchorNode
        if (anchor && page.contains(anchor)) caretRef.current = readCaret(page)
      }
      paintCurrent(value)
      if (highlightOnly && caretRef.current && page) placeCaret(page, caretRef.current.start)
      refreshPageStatus()
    }, [value, highlightKey, layoutMode])

    useEffect(() => {
      const scroller = scrollRef.current
      if (!scroller) return
      refreshPageStatus()
      const onScroll = () => refreshPageStatus()
      scroller.addEventListener('scroll', onScroll, { passive: true })
      const ro =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => refreshPageStatus())
          : null
      if (pageRef.current && ro) ro.observe(pageRef.current)
      return () => {
        scroller.removeEventListener('scroll', onScroll)
        ro?.disconnect()
      }
    }, [value, layoutMode])

    const paintCurrentRef = useRef(paintCurrent)
    paintCurrentRef.current = paintCurrent

    useEffect(() => {
      const page = pageRef.current
      if (!page) return

      const commit = (command: PageCommand, insertText = '') => {
        const result = applyPageCommand(textRef.current, readCaret(page), command, insertText)
        caretRef.current = result.caret
        if (result.text !== textRef.current) {
          paintCurrentRef.current(result.text)
          onChangeRef.current(result.text)
        }
        placeCaret(page, result.caret.start)
      }

      const onKeyDown = (event: KeyboardEvent) => {
        if (revisionRef.current.length > 0) {
          if (!event.key.startsWith('Arrow')) event.preventDefault()
          return
        }
        if (composingRef.current || event.isComposing || event.keyCode === 229) return
        if (event.key.startsWith('Arrow')) return
        if (event.key === 'Enter') {
          event.preventDefault()
          commit('enter')
          return
        }
        if (event.key === 'Backspace') {
          event.preventDefault()
          commit('backspace')
          return
        }
        if (event.key === 'Delete') {
          event.preventDefault()
          commit('delete')
          return
        }
        if (event.key === 'Tab') {
          event.preventDefault()
          commit('tab')
          return
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          commit('insertText', event.key)
        }
      }

      const onPaste = (event: ClipboardEvent) => {
        if (revisionRef.current.length > 0 || composingRef.current) {
          if (revisionRef.current.length > 0) event.preventDefault()
          return
        }
        event.preventDefault()
        commit('insertText', event.clipboardData?.getData('text/plain') ?? '')
      }

      const onCompositionStart = () => {
        composingRef.current = true
        caretAtComposeRef.current = readCaret(page)
      }

      const onCompositionEnd = () => {
        composingRef.current = false
        const anchor = document.getSelection()?.anchorNode ?? null
        const anchorElement = anchor instanceof HTMLElement ? anchor : anchor?.parentElement ?? null
        const fromAnchor = anchorElement?.closest<HTMLElement>('[data-plain-start]')
        const marked = fromAnchor && page.contains(fromAnchor) ? fromAnchor : blockAt(page, caretAtComposeRef.current.start)
        if (!marked) return
        const start = Number(marked.dataset.plainStart)
        const end = Number(marked.dataset.plainEnd)
        if (!Number.isFinite(start) || !Number.isFinite(end)) return
        const composed = marked.textContent ?? ''
        const next = `${textRef.current.slice(0, start)}${composed}${textRef.current.slice(end)}`
        const caret = start + composed.length
        caretRef.current = { start: caret, end: caret }
        paintCurrentRef.current(next)
        onChangeRef.current(next)
        placeCaret(page, caret)
      }

      const onCut = (event: ClipboardEvent) => {
        if (composingRef.current) return
        const caret = readCaret(page)
        if (caret.end <= caret.start) return
        event.preventDefault()
        const from = Math.min(caret.start, caret.end)
        const to = Math.max(caret.start, caret.end)
        event.clipboardData?.setData('text/plain', textRef.current.slice(from, to))
        commit('insertText', '')
      }

      const onDrop = (event: DragEvent) => {
        if (composingRef.current) return
        event.preventDefault()
        commit('insertText', event.dataTransfer?.getData('text/plain') ?? '')
      }

      const onSelection = () => {
        const report = selectionRef.current
        const anchor = document.getSelection()?.anchorNode
        if (!anchor || !page.contains(anchor)) return
        const caret = readCaret(page)
        if (!report) return
        if (caret.end <= caret.start) {
          lastSelectionRef.current = null
          report(null)
          return
        }
        const next = {
          start: caret.start,
          end: caret.end,
          text: textRef.current.slice(caret.start, caret.end),
        }
        lastSelectionRef.current = next
        report({ ...next, rect: readSelectionRect(page) })
      }

      page.addEventListener('keydown', onKeyDown)
      page.addEventListener('paste', onPaste)
      page.addEventListener('cut', onCut)
      page.addEventListener('drop', onDrop)
      page.addEventListener('compositionstart', onCompositionStart)
      page.addEventListener('compositionend', onCompositionEnd)
      document.addEventListener('selectionchange', onSelection)
      return () => {
        page.removeEventListener('keydown', onKeyDown)
        page.removeEventListener('paste', onPaste)
        page.removeEventListener('cut', onCut)
        page.removeEventListener('drop', onDrop)
        page.removeEventListener('compositionstart', onCompositionStart)
        page.removeEventListener('compositionend', onCompositionEnd)
        document.removeEventListener('selectionchange', onSelection)
      }
    }, [])

    useImperativeHandle(ref, () => ({
      getPlainSelection() {
        const root = pageRef.current
        const anchor = document.getSelection()?.anchorNode
        if (!root || !anchor || !root.contains(anchor)) return lastSelectionRef.current
        const caret = readCaret(root)
        if (caret.end <= caret.start) {
          lastSelectionRef.current = null
          return null
        }
        const from = Math.min(caret.start, caret.end)
        const to = Math.max(caret.start, caret.end)
        const next = { start: from, end: to, text: textRef.current.slice(from, to) }
        lastSelectionRef.current = next
        return next
      },
      selectRange(start: number, end: number) {
        const root = pageRef.current
        if (!root) return
        const from = Math.max(0, Math.min(start, end, textRef.current.length))
        const to = Math.max(from, Math.min(Math.max(start, end), textRef.current.length))
        placeSelectionRange(root, from, to)
        const next = {
          start: from,
          end: to,
          text: textRef.current.slice(from, to),
          rect: readSelectionRect(root),
        }
        if (to > from) {
          lastSelectionRef.current = { start: from, end: to, text: next.text }
          selectionRef.current?.(next)
        } else {
          lastSelectionRef.current = null
          selectionRef.current?.(null)
        }
      },
      scrollToRange(start: number) {
        const root = pageRef.current
        const scroller = scrollRef.current
        if (!root || !scroller) return
        const nodes = [...root.querySelectorAll<HTMLElement>('[data-plain-start]')]
        let marker = nodes.find((element) => {
          const from = Number(element.dataset.plainStart)
          const to = Number(element.dataset.plainEnd)
          return from <= start && start < to
        })
        if (!marker) {
          let best = -1
          for (const element of nodes) {
            const to = Number(element.dataset.plainEnd)
            if (to <= start && to >= best) {
              best = to
              marker = element
            }
          }
        }
        if (marker) scrollPageToRange(scroller, marker)
      },
      scrollToTop() {
        if (scrollRef.current) scrollRef.current.scrollTop = 0
      }
    }))

    return (
      <div className={`document-page-shell ${className}`.trim()}>
        <div ref={scrollRef} className="document-page-scroll">
          <div className="document-a4-stack document-page-a4-stack">
            <PageSurface surfaceRef={pageRef} layoutMode={layoutMode} />
          </div>
        </div>
        <div className="document-a4-status" role="status" aria-live="polite">
          {pageStatus}
        </div>
      </div>
    )
  },
)

export default DocumentTextEditor

export type { TextHighlightRange }
