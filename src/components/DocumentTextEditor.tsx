import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react'
import type { TextHighlightRange } from '../utils/documentLocate'
import { scrollPageToRange } from '../utils/documentLocate'
import { parseDocumentPage, type DocumentPageBlock } from '../utils/documentPageBlocks'

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

function renderMarkedText(
  text: string,
  absStart: number,
  highlightRange: TextHighlightRange | null,
  aiHighlightRanges: TextHighlightRange[],
): ReactNode {
  if (!text) return null
  const absEnd = absStart + text.length
  const cuts = new Set<number>([absStart, absEnd])
  const consider = [
    highlightRange,
    ...aiHighlightRanges,
  ].filter((range): range is TextHighlightRange => !!range && range.end > range.start)
  for (const range of consider) {
    cuts.add(Math.max(absStart, Math.min(range.start, absEnd)))
    cuts.add(Math.max(absStart, Math.min(range.end, absEnd)))
  }
  const points = [...cuts].sort((a, b) => a - b)
  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1] ?? start
    if (end <= start) return null
    const slice = text.slice(start - absStart, end - absStart)
    const variant = sliceVariant(start, end, highlightRange, aiHighlightRanges)
    if (variant === 'plain') return slice
    const className =
      variant === 'ai' ? 'document-ai-write-highlight' : `document-issue-highlight ${variant}`
    return (
      <mark key={`${start}-${end}`} className={className}>
        {slice}
      </mark>
    )
  })
}

function blockNode(
  block: DocumentPageBlock,
  highlightRange: TextHighlightRange | null,
  aiHighlightRanges: TextHighlightRange[],
): ReactNode {
  if (block.kind === 'blank') {
    return <div key={`b-${block.start}`} className="document-page-gap" />
  }
  if (block.kind === 'table') {
    return (
      <table key={`t-${block.start}`} className="document-page-table">
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.lineStart}>
              {row.cells.map((cell) => (
                <td key={cell.start} data-plain-start={cell.start} data-plain-end={cell.end}>
                  {renderMarkedText(cell.text, cell.start, highlightRange, aiHighlightRanges)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  const className =
    block.kind === 'heading'
      ? 'document-page-heading'
      : `document-page-body${OWN_INDENT.test(block.text) ? ' document-page-own-indent' : ''}`
  return (
    <p
      key={`${block.kind}-${block.start}`}
      className={className}
      data-level={block.kind === 'heading' ? block.level : undefined}
      data-plain-start={block.start}
      data-plain-end={block.end}
    >
      {renderMarkedText(block.text, block.start, highlightRange, aiHighlightRanges)}
    </p>
  )
}

const DocumentTextEditor = forwardRef<DocumentPageEditorHandle, DocumentTextEditorProps>(
  function DocumentTextEditor(
    {
      value,
      onChange: _onChange,
      highlightRange,
      aiHighlightRanges = [],
      className = '',
      placeholder: _placeholder,
      onSelectionChange: _onSelectionChange,
    },
    ref,
  ) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const pageRef = useRef<HTMLDivElement>(null)
    const blocks = parseDocumentPage(value)

    useImperativeHandle(ref, () => ({
      getPlainSelection() {
        const root = pageRef.current
        const selection = document.getSelection()
        if (!root || !selection || selection.rangeCount === 0) return null
        const range = selection.getRangeAt(0)
        if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
        const start = plainOffsetFromNode(root, range.startContainer, range.startOffset)
        const end = plainOffsetFromNode(root, range.endContainer, range.endOffset)
        if (start == null || end == null) return null
        const from = Math.min(start, end)
        const to = Math.max(start, end)
        if (to <= from) return null
        return { start: from, end: to, text: value.slice(from, to) }
      },
      scrollToRange(start: number) {
        const root = pageRef.current
        const scroller = scrollRef.current
        if (!root || !scroller) return
        const nodes = [...root.querySelectorAll<HTMLElement>('[data-plain-start]')]
        let marker = nodes.find((element) => {
          const from = Number(element.getAttribute('data-plain-start'))
          const to = Number(element.getAttribute('data-plain-end'))
          return from <= start && start < to
        })
        if (!marker) {
          let best = -1
          for (const element of nodes) {
            const to = Number(element.getAttribute('data-plain-end'))
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
      },
    }), [value])

    return (
      <div ref={scrollRef} className={`document-page-scroll ${className}`.trim()}>
        <div ref={pageRef} className="document-page document-page-editor">
          {blocks.map((block) => blockNode(block, highlightRange, aiHighlightRanges))}
        </div>
      </div>
    )
  },
)

export default DocumentTextEditor

export type { TextHighlightRange }
