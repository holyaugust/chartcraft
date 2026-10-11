import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import DocumentStructurePanel from './DocumentStructurePanel'
import type { DocumentStructureAnalysisResult } from '../utils/documentStructureAnalysis'

const report: DocumentStructureAnalysisResult = {
  summary: '主题清晰；论证整体顺畅，未见明显跳跃。',
  outline: ['一、概况'],
  logicFlow: [],
  gaps: ['未见明显结构缺口'],
  suggestions: [
    {
      tag: '补缺',
      target: '全文',
      text: '补充风险专节',
      raw: '【补缺｜全文】补充风险专节',
    },
  ],
  rawMarkdown: '',
}

describe('DocumentStructurePanel tabs without logic section', () => {
  it('does not show a dedicated logic tab; summary still carries logic note', () => {
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
        />,
      )
    })

    const tabLabels = [...host.querySelectorAll('[role="tab"]')].map((tab) =>
      (tab.textContent ?? '').replace(/\d+/g, '').trim(),
    )
    expect(tabLabels.some((label) => label.includes('逻辑'))).toBe(false)
    expect(tabLabels.some((label) => label.includes('大纲'))).toBe(true)
    expect(host.textContent).toContain('论证整体顺畅')

    act(() => root.unmount())
  })

  it('collapsed rail keeps the outline directory for navigation', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)
    act(() => {
      root.render(
        <DocumentStructurePanel
          report={report}
          outlineDirectory={[
            {
              title: '一、概况',
              found: true,
              charCount: 100,
              short: false,
              level: 1,
              section: {
                title: '一、概况',
                headingStart: 0,
                headingEnd: 4,
                bodyStart: 5,
                sectionEnd: 10,
              },
            },
          ]}
          collapsed
          onRefresh={() => {}}
          onDismiss={() => {}}
          onLocateItem={() => {}}
          onRefineSection={() => {}}
          onOptimizeSuggestion={() => {}}
          onConfirmPatch={() => {}}
          onCancelPatch={() => {}}
        />,
      )
    })

    expect(host.querySelector('.document-structure-panel.is-rail')).toBeTruthy()
    expect(host.textContent).toContain('一、概况')
    expect(host.textContent).toContain('改本节')
    expect(host.querySelector('[aria-label="展开结构梳理"]')).toBeTruthy()
    expect(host.querySelector('[role="tab"]')).toBeNull()

    act(() => root.unmount())
  })

  it('expanded panel shows summary and structure tabs by default', () => {
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
          onToggleCollapsed={() => {}}
        />,
      )
    })

    expect(host.querySelector('.document-structure-panel.is-rail')).toBeNull()
    expect(host.textContent).toContain('结构梳理')
    expect(host.textContent).toContain('总体判断')
    expect(host.querySelector('[aria-label="收起结构梳理"]')).toBeTruthy()

    act(() => root.unmount())
  })

  it('does not show a gaps tab; no-issue suggestions count as zero', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)
    act(() => {
      root.render(
        <DocumentStructurePanel
          report={{
            ...report,
            gaps: ['未见明显结构缺口'],
            suggestions: [
              {
                tag: '理顺',
                target: '全文',
                text: '暂无明显结构调整建议',
                raw: '【理顺｜全文】暂无明显结构调整建议',
              },
            ],
          }}
          onRefresh={() => {}}
          onDismiss={() => {}}
          onLocateItem={() => {}}
          onOptimizeSuggestion={() => {}}
          onConfirmPatch={() => {}}
          onCancelPatch={() => {}}
        />,
      )
    })

    const tabs = [...host.querySelectorAll('[role="tab"]')]
    const tabLabels = tabs.map((tab) => (tab.textContent ?? '').replace(/\d+/g, '').trim())
    expect(tabLabels.some((label) => label.includes('缺口'))).toBe(false)
    expect(tabLabels.some((label) => label.includes('大纲'))).toBe(true)
    expect(tabLabels.some((label) => label.includes('建议'))).toBe(true)
    const suggestionsTab = tabs.find((tab) => tab.textContent?.includes('建议'))
    expect(suggestionsTab?.querySelector('em')?.textContent).toBe('0')

    act(() => root.unmount())
  })
})
