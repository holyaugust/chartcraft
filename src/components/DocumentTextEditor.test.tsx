import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import DocumentTextEditor, { plainOffsetFromNode, type DocumentPageEditorHandle } from './DocumentTextEditor'
import { scrollPageToRange } from '../utils/documentLocate'

function renderEditor(value: string, props: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root: Root = createRoot(host)
  const ref = createRef<DocumentPageEditorHandle>()
  act(() => {
    root.render(<DocumentTextEditor ref={ref} value={value} onChange={() => {}} {...props} />)
  })
  return { host, root, ref }
}

describe('DocumentTextEditor page', () => {
  it('renders a heading and a table', () => {
    const { host, root } = renderEditor('一、标题\n正文\n甲 | 乙')
    const heading = host.querySelector('[data-level="h1"]')
    expect(heading?.textContent).toBe('一、标题')
    const rows = host.querySelectorAll('tr')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.querySelectorAll('td')).toHaveLength(2)
    expect(rows[0]?.textContent).toContain('甲')
    expect(rows[0]?.textContent).toContain('乙')
    act(() => root.unmount())
  })

  it('does not add a first-line indent class when the line already has indent', () => {
    const { host, root } = renderEditor('\u3000已有缩进')
    expect(host.querySelector('.document-page-own-indent')).not.toBeNull()
    act(() => root.unmount())
  })

  it('marks a proofread range with the pending class', () => {
    const { host, root } = renderEditor('甲乙丙', {
      highlightRange: { start: 1, end: 2 },
    })
    expect(host.querySelector('mark.document-issue-highlight.pending')?.textContent).toBe('乙')
    act(() => root.unmount())
  })

  it('reads a cross-table selection as a slice of the plain text', () => {
    const text = '甲 | 乙'
    const { host, ref, root } = renderEditor(text)
    const cells = host.querySelectorAll('td')
    const first = cells[0]?.firstChild as Text
    const second = cells[1]?.firstChild as Text
    expect(plainOffsetFromNode(host, first, 0)).toBe(0)
    expect(plainOffsetFromNode(host, second, 1)).toBe(5)
    const range = document.createRange()
    range.setStart(first, 0)
    range.setEnd(second, 1)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    expect(ref.current?.getPlainSelection()).toEqual({ start: 0, end: 5, text: '甲 | 乙' })
    act(() => root.unmount())
  })

  it('scrolls the page handle to the heading', () => {
    const { host, ref, root } = renderEditor('一、标题\n正文')
    const scroller = host.querySelector('.document-page-scroll') as HTMLElement
    const heading = host.querySelector('[data-level="h1"]') as HTMLElement
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 800 })
    Object.defineProperty(heading, 'offsetTop', { configurable: true, value: 240 })
    Object.defineProperty(heading, 'offsetHeight', { configurable: true, value: 20 })
    act(() => {
      ref.current?.scrollToRange(0, 1)
    })
    expect(scroller.scrollTop).toBe(200)
    act(() => root.unmount())
  })

  it('centers the marker inside the page scroller', () => {
    const container = document.createElement('div')
    const marker = document.createElement('div')
    Object.defineProperty(container, 'clientHeight', { value: 100 })
    Object.defineProperty(container, 'scrollHeight', { value: 800 })
    Object.defineProperty(marker, 'offsetTop', { value: 240 })
    Object.defineProperty(marker, 'offsetHeight', { value: 20 })
    scrollPageToRange(container, marker)
    expect(container.scrollTop).toBe(200)
  })

  it('splits at the zero caret on enter and on shift+enter', () => {
    const run = (shiftKey: boolean) => {
      let next = ''
      const { host, root } = renderEditor('甲乙', {
        onChange: (value: string) => {
          next = value
        },
      })
      const page = host.querySelector('.document-page-editor') as HTMLElement
      page.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey, bubbles: true }))
      expect(next).toBe('\n甲乙')
      act(() => root.unmount())
    }
    run(false)
    run(true)
  })

  it('does not call onChange for arrow keys', () => {
    let calls = 0
    const { host, root } = renderEditor('甲乙', {
      onChange: () => {
        calls += 1
      },
    })
    const page = host.querySelector('.document-page-editor') as HTMLElement
    page.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(calls).toBe(0)
    act(() => root.unmount())
  })

  it('pastes only plain text at the zero caret', () => {
    let next = ''
    const { host, root } = renderEditor('甲', {
      onChange: (value: string) => {
        next = value
      },
    })
    const page = host.querySelector('.document-page-editor') as HTMLElement
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData: (type: string) => (type === 'text/plain' ? '乙 | 丙' : '<b>乙</b>'),
      },
    })
    page.dispatchEvent(event)
    expect(next).toBe('乙 | 丙甲')
    expect(next).not.toContain('<b>')
    act(() => root.unmount())
  })

  it('does not rebuild the page when the parent echoes the edited string', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    let value = '甲乙'
    const draw = () => {
      act(() => {
        root.render(
          <DocumentTextEditor
            value={value}
            onChange={(next) => {
              value = next
            }}
          />,
        )
      })
    }
    draw()
    const page = host.querySelector('.document-page-editor') as HTMLElement
    act(() => {
      page.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    const block = host.querySelector('[data-plain-start]') as HTMLElement
    block.dataset.marker = 'keep'
    draw()
    expect(host.querySelector('[data-marker="keep"]')).not.toBeNull()
    act(() => root.unmount())
  })

  it('keeps in-progress composition text when the parent re-renders', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const draw = (value: string) => {
      act(() => {
        root.render(<DocumentTextEditor value={value} onChange={() => {}} />)
      })
    }
    draw('甲')
    const page = host.querySelector('.document-page-editor') as HTMLElement
    page.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    const block = host.querySelector('[data-plain-start]') as HTMLElement
    block.textContent = '甲乙'
    draw('完全不同的外部稿')
    expect(host.textContent).toContain('甲乙')
    expect(host.textContent).not.toContain('完全不同的外部稿')
    act(() => root.unmount())
  })

  it('rebuilds the page when the value changes from outside', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    act(() => {
      root.render(<DocumentTextEditor value="甲" onChange={() => {}} />)
    })
    act(() => {
      root.render(<DocumentTextEditor value="全新" onChange={() => {}} />)
    })
    expect(host.textContent).toContain('全新')
    expect(host.textContent).not.toContain('甲')
    act(() => root.unmount())
  })
})
