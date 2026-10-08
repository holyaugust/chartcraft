import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import DocumentStructurePanel from './DocumentStructurePanel'
import type { DocumentStructureAnalysisResult } from '../utils/documentStructureAnalysis'

const report: DocumentStructureAnalysisResult = {
  summary: '主题清晰',
  outline: ['一、概况'],
  logicFlow: [],
  gaps: [],
  suggestions: ['补充风险专节'],
  rawMarkdown: '',
}

function renderPanel(props: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root: Root = createRoot(host)
  const onUndoLastWrite = vi.fn()
  act(() => {
    root.render(
      <DocumentStructurePanel
        report={report}
        onRefresh={() => {}}
        onDismiss={() => {}}
        onLocateItem={() => {}}
        onOptimizeSuggestion={() => {}}
        onConfirmPatch={() => {}}
        onCancelPatch={() => {}}
        appliedSuggestions={new Set(['补充风险专节'])}
        canUndoLastWrite={false}
        onUndoLastWrite={onUndoLastWrite}
        {...props}
      />,
    )
  })
  return { host, root, onUndoLastWrite }
}

describe('DocumentStructurePanel undo affordance', () => {
  it('hides undo when canUndoLastWrite is false', () => {
    const { host, root } = renderPanel({ canUndoLastWrite: false })
    expect([...host.querySelectorAll('button')].some((b) => b.textContent?.includes('撤销上次结构写入'))).toBe(
      false,
    )
    act(() => root.unmount())
  })

  it('shows undo and calls onUndoLastWrite', () => {
    const { host, root, onUndoLastWrite } = renderPanel({ canUndoLastWrite: true })
    const undo = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('撤销上次结构写入'),
    )
    expect(undo).toBeTruthy()
    act(() => {
      undo?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onUndoLastWrite).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
  })
})
