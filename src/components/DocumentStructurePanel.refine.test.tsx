import { createRoot, type Root } from 'react-dom/client'
import { act, type ComponentProps } from 'react'
import { describe, expect, it } from 'vitest'
import DocumentLocalRefineCard from './DocumentLocalRefineCard'
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

function renderFooterCard(props: Partial<ComponentProps<typeof DocumentLocalRefineCard>> = {}) {
  return (
    <DocumentLocalRefineCard
      prompt=""
      onPromptChange={() => {}}
      selectedPreview={null}
      busy={false}
      error={null}
      onSubmit={() => {}}
      collapsible
      {...props}
    />
  )
}

describe('DocumentStructurePanel local refine footer', () => {
  it('keeps refine collapsed by default so structure outline keeps space', () => {
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
          footer={renderFooterCard()}
        />,
      )
    })

    const collapsed = host.querySelector('.document-local-refine-collapsed')
    expect(collapsed).toBeTruthy()
    expect(collapsed?.className).toContain('is-accent')
    expect(host.querySelector('.document-local-refine-input')).toBeNull()
    expect(host.textContent).toContain('你想对这篇文档做什么')
    expect(host.textContent).toContain('展开')

    act(() => {
      collapsed?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('.document-local-refine-input')).toBeTruthy()

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
          footer={renderFooterCard()}
        />,
      )
    })

    expect(host.querySelector('.document-local-refine')).toBeNull()
    expect(host.querySelector('.document-local-refine-collapsed')).toBeNull()

    act(() => root.unmount())
    host.remove()
  })
})
