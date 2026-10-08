import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import DocumentStructurePanel from './DocumentStructurePanel'
import type { DocumentStructureAnalysisResult } from '../utils/documentStructureAnalysis'
import type { OutlineDirectoryEntry } from '../utils/documentOutlineSections'

const report: DocumentStructureAnalysisResult = {
  summary: '主题清晰',
  outline: ['一、企业基本情况', '（二）主要方向'],
  logicFlow: [],
  gaps: [],
  suggestions: [],
  rawMarkdown: '',
}

const directory: OutlineDirectoryEntry[] = [
  {
    title: '一、企业基本情况',
    found: true,
    charCount: 120,
    short: false,
    section: {
      title: '一、企业基本情况',
      headingStart: 0,
      headingEnd: 8,
      bodyStart: 9,
      sectionEnd: 40,
    },
  },
  {
    title: '（二）主要方向',
    found: true,
    charCount: 12,
    short: true,
    section: {
      title: '（二）主要方向',
      headingStart: 40,
      headingEnd: 48,
      bodyStart: 49,
      sectionEnd: 60,
    },
  },
]

function renderPanel(props: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root: Root = createRoot(host)
  const onRefineSection = vi.fn()
  const onLocateItem = vi.fn()
  act(() => {
    root.render(
      <DocumentStructurePanel
        report={report}
        outlineDirectory={directory}
        onRefresh={() => {}}
        onDismiss={() => {}}
        onLocateItem={onLocateItem}
        onOptimizeSuggestion={() => {}}
        onConfirmPatch={() => {}}
        onCancelPatch={() => {}}
        onRefineSection={onRefineSection}
        {...props}
      />,
    )
  })
  return { host, root, onRefineSection, onLocateItem }
}

describe('DocumentStructurePanel outline directory', () => {
  it('shows char counts, short badges, and refine-section actions', () => {
    const { host, root, onRefineSection } = renderPanel()
    expect(host.textContent).toContain('约120字')
    expect(host.textContent).toContain('偏短')
    const refine = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('改本节'),
    )
    expect(refine).toBeTruthy()
    act(() => {
      refine?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onRefineSection).toHaveBeenCalledWith('一、企业基本情况')
    act(() => root.unmount())
  })
})
