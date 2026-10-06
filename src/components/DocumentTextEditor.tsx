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
  highlightRange: TextHighlightRange | null
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
  if (node.nodeType !== Node.TEXT_NODE) return start + offset

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
  if (!text) return
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
    { value, onChange, highlightRange, aiHighlightRanges = [], className = '', placeholder: _placeholder, onSelectionChange },
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
      paintCurrent(value)
    }, [value, highlightKey])

    const paintCurrentRef = useRef(paintCurrent)
    paintCurrentRef.current = paintCurrent

    useEffect(() => {
      const page = pageRef.current
      if (!page) return

      const commit = (command: PageCommand, insertText = '') => {
        const result = applyPageCommand(textRef.current, readCaret(page), command, insertText)
        paintCurrentRef.current(result.text)
        onChangeRef.current(result.text)
      }

      const onKeyDown = (event: KeyboardEvent) => {
        if (composingRef.current || event.isComposing) return
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
      }

      const onCompositionEnd = (event: CompositionEvent) => {
        composingRef.current = false
        const target = event.target instanceof HTMLElement ? event.target : null
        const marked = target?.closest<HTMLElement>('[data-plain-start]')
        if (!marked) return
        const start = Number(marked.dataset.plainStart)
        const end = Number(marked.dataset.plainEnd)
        if (!Number.isFinite(start) || !Number.isFinite(end)) return
        const next = `${textRef.current.slice(0, start)}${marked.textContent ?? ''}${textRef.current.slice(end)}`
        paintCurrentRef.current(next)
        onChangeRef.current(next)
      }

      const onSelection = () => {
        const report = selectionRef.current
        if (!report) return
        const caret = readCaret(page)
        if (caret.end <= caret.start) {
          report(null)
          return
        }
        report({ start: caret.start, end: caret.end, text: textRef.current.slice(caret.start, caret.end) })
      }

      page.addEventListener('keydown', onKeyDown)
      page.addEventListener('paste', onPaste)
      page.addEventListener('compositionstart', onCompositionStart)
      page.addEventListener('compositionend', onCompositionEnd)
      document.addEventListener('selectionchange', onSelection)
      return () => {
        page.removeEventListener('keydown', onKeyDown)
        page.removeEventListener('paste', onPaste)
        page.removeEventListener('compositionstart', onCompositionStart)
        page.removeEventListener('compositionend', onCompositionEnd)
        document.removeEventListener('selectionchange', onSelection)
      }
    }, [])

    useImperativeHandle(ref, () => ({
      getPlainSelection() {
        const root = pageRef.current
        if (!root) return null
        const caret = readCaret(root)
        if (caret.end <= caret.start) return null
        const from = Math.min(caret.start, caret.end)
        const to = Math.max(caret.start, caret.end)
        return { start: from, end: to, text: textRef.current.slice(from, to) }
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
