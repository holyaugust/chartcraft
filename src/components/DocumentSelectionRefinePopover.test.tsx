import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import DocumentSelectionRefinePopover, {
  selectionRefinePopoverStyle,
} from './DocumentSelectionRefinePopover'

function renderPopover(props: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root: Root = createRoot(host)
  const onSubmit = vi.fn()
  const onDismiss = vi.fn()
  const onPromptChange = vi.fn()
  act(() => {
    root.render(
      <DocumentSelectionRefinePopover
        open
        selectedPreview="公司上市以来持续积极开展资本运作。"
        prompt=""
        onPromptChange={onPromptChange}
        busy={false}
        error={null}
        onSubmit={onSubmit}
        onDismiss={onDismiss}
        anchor={{ top: 120, left: 40, bottom: 160, width: 280, height: 40 }}
        {...props}
      />,
    )
  })
  return { host, root, onSubmit, onDismiss, onPromptChange }
}

describe('DocumentSelectionRefinePopover', () => {
  it('does not render when closed', () => {
    const { host, root } = renderPopover({ open: false })
    expect(host.querySelector('[aria-label="按指令修改选中内容"]')).toBeNull()
    act(() => root.unmount())
  })

  it('shows the selected excerpt and applies the instruction', () => {
    const { host, root, onSubmit, onPromptChange } = renderPopover({ prompt: '写得更正式' })
    const popover = host.querySelector('[aria-label="按指令修改选中内容"]') as HTMLElement
    expect(popover.textContent).toContain('公司上市以来持续积极开展资本运作。')
    expect(host.querySelector('textarea')).toBeTruthy()
    const apply = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('应用'))
    expect(apply).toBeTruthy()
    act(() => {
      apply?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
  })

  it('disables apply when the prompt is empty', () => {
    const { host, root, onSubmit } = renderPopover({ prompt: '   ' })
    const apply = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('应用')) as HTMLButtonElement
    expect(apply.disabled).toBe(true)
    act(() => {
      apply.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onSubmit).not.toHaveBeenCalled()
    act(() => root.unmount())
  })

  it('dismisses on Escape', () => {
    const { host, root, onDismiss } = renderPopover({ prompt: '更简洁' })
    act(() => {
      host.querySelector('[aria-label="按指令修改选中内容"]')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
  })

  it('shows a consultative answer in the popover', () => {
    const { host, root } = renderPopover({
      prompt: '这段和国资整合有什么关联？',
      answer: '该段描述了股权并购路径。',
    })
    expect(host.textContent).toContain('该段描述了股权并购路径。')
    act(() => root.unmount())
  })

  it('places the popover below the selection and keeps it on screen', () => {
    const style = selectionRefinePopoverStyle(
      { top: 120, left: 2000, bottom: 160, width: 100, height: 40 },
      1280,
    )
    expect(style.position).toBe('fixed')
    expect(style.top).toBe(168)
    expect(Number(style.left)).toBeLessThanOrEqual(1280 - 320 - 8)
    expect(Number(style.left)).toBeGreaterThanOrEqual(8)
  })

  it('moves when the header is dragged', () => {
    const { host, root } = renderPopover({ prompt: '更有趣' })
    const head = host.querySelector('.document-selection-refine-head') as HTMLElement
    const popover = host.querySelector('[aria-label="按指令修改选中内容"]') as HTMLElement
    const beforeTop = Number.parseFloat(popover.style.top)
    const beforeLeft = Number.parseFloat(popover.style.left)

    act(() => {
      head.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true, pointerId: 1 }),
      )
    })
    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 140, clientY: 160, bubbles: true, pointerId: 1 }),
      )
    })
    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 140, clientY: 160, bubbles: true, pointerId: 1 }),
      )
    })

    expect(Number.parseFloat(popover.style.top)).toBe(beforeTop + 60)
    expect(Number.parseFloat(popover.style.left)).toBe(beforeLeft + 40)
    act(() => root.unmount())
  })

  it('resets drag offset when the selection anchor changes', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)
    const baseProps = {
      open: true,
      selectedPreview: '公司上市以来持续积极开展资本运作。',
      prompt: '更有趣',
      onPromptChange: vi.fn(),
      busy: false,
      error: null,
      onSubmit: vi.fn(),
      onDismiss: vi.fn(),
    }

    act(() => {
      root.render(
        <DocumentSelectionRefinePopover
          {...baseProps}
          anchor={{ top: 120, left: 40, bottom: 160, width: 280, height: 40 }}
        />,
      )
    })

    const head = host.querySelector('.document-selection-refine-head') as HTMLElement
    act(() => {
      head.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true, pointerId: 1 }),
      )
    })
    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 180, clientY: 200, bubbles: true, pointerId: 1 }),
      )
    })
    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 180, clientY: 200, bubbles: true, pointerId: 1 }),
      )
    })

    act(() => {
      root.render(
        <DocumentSelectionRefinePopover
          {...baseProps}
          anchor={{ top: 220, left: 80, bottom: 260, width: 280, height: 40 }}
        />,
      )
    })

    const popover = host.querySelector('[aria-label="按指令修改选中内容"]') as HTMLElement
    const expected = selectionRefinePopoverStyle({
      top: 220,
      left: 80,
      bottom: 260,
      width: 280,
      height: 40,
    })
    expect(Number.parseFloat(popover.style.top)).toBe(expected.top)
    expect(Number.parseFloat(popover.style.left)).toBe(expected.left)
    act(() => root.unmount())
  })
})
