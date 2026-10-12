import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import DocumentStructurePanel from './DocumentStructurePanel'
import type { DocumentStructureAnalysisResult } from '../utils/documentStructureAnalysis'

const report: DocumentStructureAnalysisResult = {
  summary: '主题清晰。',
  outline: ['一、概况'],
  logicFlow: [],
  gaps: [],
  suggestions: [],
  rawMarkdown: '',
}

describe('DocumentStructurePanel local refine footer', () => {
  it('renders a refine footer in the structure stage panel', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)

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
          footer={<div data-testid="structure-refine">你想对这篇文档做什么</div>}
        />,
      )
    })

    expect(host.querySelector('[data-testid="structure-refine"]')).toBeTruthy()
    expect(host.textContent).toContain('你想对这篇文档做什么')

    act(() => root.unmount())
    host.remove()
  })

  it('hides the refine footer while the structure rail is collapsed', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)

    act(() => {
      root.render(
        <DocumentStructurePanel
          report={report}
          collapsed
          onRefresh={() => {}}
          onDismiss={() => {}}
          onLocateItem={() => {}}
          onOptimizeSuggestion={() => {}}
          onConfirmPatch={() => {}}
          onCancelPatch={() => {}}
          footer={<div data-testid="structure-refine">你想对这篇文档做什么</div>}
        />,
      )
    })

    expect(host.querySelector('[data-testid="structure-refine"]')).toBeNull()

    act(() => root.unmount())
    host.remove()
  })
})
