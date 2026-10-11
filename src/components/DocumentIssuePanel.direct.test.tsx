import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import DocumentIssuePanel from './DocumentIssuePanel'

describe('DocumentIssuePanel direct proofread entry', () => {
  it('starts proofread directly and exposes adjust-plan entry', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)
    const onStartProofread = vi.fn()
    const onAdjustProofreadPlan = vi.fn()

    act(() => {
      root.render(
        <DocumentIssuePanel
          issues={[]}
          content="正文"
          activeIssueId={null}
          adoptedIssueIds={new Set()}
          onLocate={() => {}}
          onToggleAdopt={() => {}}
          onToggleAdoptGroup={() => {}}
          onApplyAll={() => {}}
          onDismiss={() => {}}
          onStartProofread={onStartProofread}
          onAdjustProofreadPlan={onAdjustProofreadPlan}
        />,
      )
    })

    expect(host.textContent).toMatch(/自动识别文体/)
    expect(host.textContent).not.toContain('先确认文体与校对要求')

    const startButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('开始智能校对'),
    )
    const adjustButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('调整方案'),
    )

    expect(startButton).toBeTruthy()
    expect(adjustButton).toBeTruthy()

    act(() => {
      startButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      adjustButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onStartProofread).toHaveBeenCalledTimes(1)
    expect(onAdjustProofreadPlan).toHaveBeenCalledTimes(1)

    act(() => root.unmount())
    host.remove()
  })
})
