import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import DocumentIssuePanel from './DocumentIssuePanel'
import type { DocumentIssue } from '../utils/documentProofread'

const sampleIssue: DocumentIssue = {
  id: 'i1',
  category: 'typo',
  message: '旧结果不应在校对中展示',
  start: 0,
  end: 2,
  original: '旧文',
  suggestion: '新文',
  autoFixable: true,
}

describe('DocumentIssuePanel busy proofread state', () => {
  it('shows a loading placeholder instead of previous results while busy', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)

    act(() => {
      root.render(
        <DocumentIssuePanel
          issues={[sampleIssue]}
          content="旧文"
          completed
          genreLabel="计划总结"
          activeIssueId={null}
          adoptedIssueIds={new Set()}
          busy
          onLocate={() => {}}
          onToggleAdopt={() => {}}
          onToggleAdoptGroup={() => {}}
          onApplyAll={() => {}}
          onDismiss={() => {}}
          onStartProofread={() => {}}
        />,
      )
    })

    expect(host.textContent).toMatch(/正在智能校对/)
    expect(host.textContent).not.toContain('旧结果不应在校对中展示')
    expect(host.querySelector('.document-issue-busy')).toBeTruthy()

    act(() => root.unmount())
    host.remove()
  })
})
