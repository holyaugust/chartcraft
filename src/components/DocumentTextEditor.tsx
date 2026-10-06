import { forwardRef, memo, useEffect, useImperativeHandle, useLayoutEffect, useRef, type RefObject } from 'react'
import type { TextHighlightRange } from '../utils/documentLocate'
import { scrollPageToRange } from '../utils/documentLocate'
import {
  applyPageCommand,
  parseDocumentPage,
  type DocumentPageBlock,
  type PageCaret,
  type PageCommand,
} from '../utils/documentPageBlocks'

interface DocumentTextEditorProps {
  value: string
  onChange: (value: string) => void
  highlightRange?: TextHighlightRange | null
  aiHighlightRanges?: TextHighlightRange[]
  className?: string
  placeholder?: string
  onSelectionChange?: (selection: { start: number; end: number; text: string } | null) => void
}

export interface DocumentPageEditorHandle {
  getPlainSelection(): { start: number; end: number; text: string } | null
  scrollToRange(start: number, end: number): void
  scrollToTop(): void
}

type MarkVariant = 'plain' | 'pending' | 'adopted' | 'ai'

const OWN_INDENT = /^[ \t\u3000]/u

const PageSurface = memo(function PageSurface({
  surfaceRef,
}: {
  surfaceRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      ref={surfaceRef}
      className="document-page document-page-editor"
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

function sliceVariant(
  absStart: number,
  absEnd: number,
  highlightRange: TextHighlightRange | null,
  aiHighlightRanges: TextHighlightRange[],
): MarkVariant {
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
  const points = [...cuts].sort((a, b) => a - b)
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index] ?? absStart
    const end = points[index + 1] ?? start
    if (end <= start) continue
    const slice = text.slice(start - absStart, end - absStart)
    const variant = sliceVariant(start, end, highlightRange, aiHighlightRanges)
    if (variant === 'plain') {
      parent.append(document.createTextNode(slice))
      continue
    }
    const mark = document.createElement('mark')
    mark.className =
      variant === 'ai' ? 'document-ai-write-highlight' : `document-issue-highlight ${variant}`
    mark.textContent = slice
    parent.append(mark)
  }
}

function createBlock(
  block: DocumentPageBlock,
  highlightRange: TextHighlightRange | null,
  aiHighlightRanges: TextHighlightRange[],
): HTMLElement {
  if (block.kind === 'blank') {
    const gap = document.createElement('div')
    gap.className = 'document-page-gap'
    gap.dataset.plainStart = String(block.start)
    gap.dataset.plainEnd = String(block.end)
    gap.append(document.createElement('br'))
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
        appendMarked(td, cell.text, cell.start, highlightRange, aiHighlightRanges)
        tr.append(td)
      }
      body.append(tr)
    }
    table.append(body)
    return table
  }
  const paragraph = document.createElement('p')
  paragraph.className =
    block.kind === 'heading'
      ? 'document-page-heading'
      : `document-page-body${OWN_INDENT.test(block.text) ? ' document-page-own-indent' : ''}`
  if (block.kind === 'heading') paragraph.dataset.level = block.level
  paragraph.dataset.plainStart = String(block.start)
  paragraph.dataset.plainEnd = String(block.end)
  appendMarked(paragraph, block.text, block.start, highlightRange, aiHighlightRanges)
  return paragraph
}

function paintPage(
  root: HTMLElement,
  value: string,
  highlightRange: TextHighlightRange | null,
  aiHighlightRanges: TextHighlightRange[],
) {
  const fragment = document.createDocumentFragment()
  for (const block of parseDocumentPage(value)) {
    fragment.append(createBlock(block, highlightRange, aiHighlightRanges))
  }
  root.replaceChildren(fragment)
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

function placeCaret(root: HTMLElement, offset: number) {
  const target = blockAt(root, offset)
  const selection = document.getSelection()
  if (!target || !selection) return
  const local = offset - Number(target.dataset.plainStart)
  const range = document.createRange()
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
  let remaining = local
  let node = walker.nextNode()
  if (!node) {
    range.setStart(target, 0)
  } else {
    while (node) {
      const length = node.textContent?.length ?? 0
      const next = walker.nextNode()
      if (remaining <= length || !next) {
        range.setStart(node, Math.min(remaining, length))
        break
      }
      remaining -= length
      node = next
    }
  }
  range.collapse(true)
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

const DocumentTextEditor = forwardRef<DocumentPageEditorHandle, DocumentTextEditorProps>(
  function DocumentTextEditor(
    { value, onChange, highlightRange = null, aiHighlightRanges = [], className = '', placeholder: _placeholder, onSelectionChange },
    ref,
  ) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const pageRef = useRef<HTMLDivElement>(null)
    const textRef = useRef(value)
    const emittedRef = useRef<string | null>(null)
    const composingRef = useRef(false)
    const onChangeRef = useRef(onChange)
    const highlightRef = useRef(highlightRange)
    const aiRef = useRef(aiHighlightRanges)
    const selectionRef = useRef(onSelectionChange)
    const highlightKeyRef = useRef('')
    const caretRef = useRef<PageCaret | null>(null)
    const caretAtComposeRef = useRef<PageCaret>({ start: 0, end: 0 })
    const lastSelectionRef = useRef<{ start: number; end: number; text: string } | null>(null)
    const highlightKey = `${highlightRange?.start ?? ''}:${highlightRange?.end ?? ''}:${highlightRange?.adopted ?? ''}|${aiHighlightRanges.map((range) => `${range.start}:${range.end}:${range.adopted ?? ''}`).join(',')}`
    onChangeRef.current = onChange
    highlightRef.current = highlightRange
    aiRef.current = aiHighlightRanges
    selectionRef.current = onSelectionChange

    const paintCurrent = (next: string) => {
      const page = pageRef.current
      if (!page) return
      paintPage(page, next, highlightRef.current, aiRef.current)
      textRef.current = next
      emittedRef.current = next
      highlightKeyRef.current = highlightKey
    }

    useLayoutEffect(() => {
      if (composingRef.current) return
      if (emittedRef.current === value && highlightKeyRef.current === highlightKey) return
      const page = pageRef.current
      const highlightOnly = emittedRef.current === value
      if (highlightOnly && page) {
        const anchor = document.getSelection()?.anchorNode
        if (anchor && page.contains(anchor)) caretRef.current = readCaret(page)
      }
      paintCurrent(value)
      if (highlightOnly && caretRef.current && page) placeCaret(page, caretRef.current.start)
    }, [value, highlightKey])

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
        if (composingRef.current) return
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
        report(next)
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
      <div ref={scrollRef} className={`document-page-scroll ${className}`.trim()}>
        <PageSurface surfaceRef={pageRef} />
      </div>
    )
  },
)

export default DocumentTextEditor

export type { TextHighlightRange }
