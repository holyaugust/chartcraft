import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SELECTION_REFINE_HINT_KEY,
  loadSelectionRefineHintDismissed,
  saveSelectionRefineHintDismissed,
  shouldShowSelectionRefineHint,
} from './documentSelectionRefineHint'

describe('documentSelectionRefineHint', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('shows only for editable body with no selection and not dismissed', () => {
    expect(
      shouldShowSelectionRefineHint({
        dismissed: false,
        hasContent: true,
        viewMode: 'text',
        workflowStep: 'structure',
        hasSelection: false,
      }),
    ).toBe(true)

    expect(
      shouldShowSelectionRefineHint({
        dismissed: true,
        hasContent: true,
        viewMode: 'text',
        workflowStep: 'structure',
        hasSelection: false,
      }),
    ).toBe(false)

    expect(
      shouldShowSelectionRefineHint({
        dismissed: false,
        hasContent: true,
        viewMode: 'text',
        workflowStep: 'prepare',
        hasSelection: false,
      }),
    ).toBe(false)

    expect(
      shouldShowSelectionRefineHint({
        dismissed: false,
        hasContent: true,
        viewMode: 'text',
        workflowStep: 'structure',
        hasSelection: true,
      }),
    ).toBe(false)
  })

  it('persists dismissal in localStorage', () => {
    expect(loadSelectionRefineHintDismissed()).toBe(false)
    saveSelectionRefineHintDismissed()
    expect(localStorage.getItem(SELECTION_REFINE_HINT_KEY)).toBe('1')
    expect(loadSelectionRefineHintDismissed()).toBe(true)
  })
})

describe('DocumentSelectionRefineHint', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('auto-dismisses after 6 seconds and remembers', async () => {
    const { createRoot } = await import('react-dom/client')
    const { act } = await import('react')
    const { default: DocumentSelectionRefineHint } = await import(
      '../components/DocumentSelectionRefineHint'
    )

    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onDismiss = vi.fn()

    act(() => {
      root.render(<DocumentSelectionRefineHint open onDismiss={onDismiss} />)
    })

    expect(host.querySelector('[aria-label="选区改写提示"]')).toBeTruthy()
    expect(host.textContent).toContain('选中一段文字')

    act(() => {
      vi.advanceTimersByTime(6000)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(SELECTION_REFINE_HINT_KEY)).toBe('1')

    act(() => root.unmount())
  })

  it('dismisses when the user clicks 知道了', async () => {
    const { createRoot } = await import('react-dom/client')
    const { act } = await import('react')
    const { default: DocumentSelectionRefineHint } = await import(
      '../components/DocumentSelectionRefineHint'
    )

    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onDismiss = vi.fn()

    act(() => {
      root.render(<DocumentSelectionRefineHint open onDismiss={onDismiss} />)
    })

    const button = [...host.querySelectorAll('button')].find((el) =>
      el.textContent?.includes('知道了'),
    )
    expect(button).toBeTruthy()
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(SELECTION_REFINE_HINT_KEY)).toBe('1')
    act(() => root.unmount())
  })
})
