import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import DocumentStructurePanel from './DocumentStructurePanel'
import type { DocumentStructureAnalysisResult } from '../utils/documentStructureAnalysis'

const report: DocumentStructureAnalysisResult = {
  summary: '主题清晰',
  outline: [],
  logicFlow: [],
  gaps: [],
  suggestions: [
    {
      tag: '补缺',
      target: '二、风险提示',
      text: '补充风险与应对专节',
      raw: '【补缺｜二、风险提示】补充风险与应对专节',
    },
  ],
  rawMarkdown: '',
}

describe('DocumentStructurePanel suggestions', () => {
  it('shows tag and target section on each suggestion', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)
    const onOptimizeSuggestion = vi.fn()
    const onLocateItem = vi.fn()
    act(() => {
      root.render(
        <DocumentStructurePanel
          report={report}
          onRefresh={() => {}}
          onDismiss={() => {}}
          onLocateItem={onLocateItem}
          onOptimizeSuggestion={onOptimizeSuggestion}
          onConfirmPatch={() => {}}
          onCancelPatch={() => {}}
        />,
      )
    })

    const suggestionsTab = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('建议'),
    )
    act(() => {
      suggestionsTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(host.textContent).toContain('补缺')
    expect(host.textContent).toContain('动：二、风险提示')
    expect(host.textContent).toContain('补充风险与应对专节')

    const optimize = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('智能优化'),
    )
    act(() => {
      optimize?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onOptimizeSuggestion).toHaveBeenCalledWith(
      '【补缺｜二、风险提示】补充风险与应对专节',
    )

    act(() => root.unmount())
  })
})
