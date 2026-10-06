import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import DocumentTextEditor, { plainOffsetFromNode, type DocumentPageEditorHandle } from './DocumentTextEditor'
import { scrollPageToRange } from '../utils/documentLocate'
import '../App.css'

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
    scroller.getBoundingClientRect = () =>
      ({ top: 0, left: 0, right: 0, bottom: 100, width: 0, height: 100, x: 0, y: 0, toJSON() {} }) as DOMRect
    heading.getBoundingClientRect = () =>
      ({ top: 240, left: 0, right: 0, bottom: 260, width: 0, height: 20, x: 0, y: 240, toJSON() {} }) as DOMRect
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
    container.getBoundingClientRect = () =>
      ({ top: 0, left: 0, right: 0, bottom: 100, width: 0, height: 100, x: 0, y: 0, toJSON() {} }) as DOMRect
    marker.getBoundingClientRect = () =>
      ({ top: 240, left: 0, right: 0, bottom: 260, width: 0, height: 20, x: 0, y: 240, toJSON() {} }) as DOMRect
    scrollPageToRange(container, marker)
    expect(container.scrollTop).toBe(200)
  })

  it('scrolls using the marker position inside the scroller', () => {
    const container = document.createElement('div')
    const marker = document.createElement('td')
    document.body.appendChild(container)
    container.append(marker)
    container.getBoundingClientRect = () =>
      ({ top: 100, left: 0, right: 0, bottom: 200, width: 0, height: 100, x: 0, y: 100, toJSON() {} }) as DOMRect
    marker.getBoundingClientRect = () =>
      ({ top: 340, left: 0, right: 0, bottom: 360, width: 0, height: 20, x: 0, y: 340, toJSON() {} }) as DOMRect
    container.scrollTop = 50
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 800 })
    scrollPageToRange(container, marker)
    expect(container.scrollTop).toBe(250)
  })

  it('keeps leading spaces visible on the page', () => {
    const css = readFileSync(resolve('src/App.css'), 'utf8')
    expect(css).toMatch(/\.document-page-body[\s\S]*?white-space:\s*pre-wrap/)
    expect(css).toMatch(/\.document-page-table td[\s\S]*?white-space:\s*pre-wrap/)
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

  it('inserts the next character at the restored caret', () => {
    let value = '甲乙'
    const { host, root } = renderEditor(value, {
      onChange: (next: string) => {
        value = next
      },
    })
    const text = host.querySelector('p')?.firstChild as Text
    const range = document.createRange()
    range.setStart(text, 1)
    range.collapse(true)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    const page = host.querySelector('.document-page-editor') as HTMLElement
    act(() => {
      page.dispatchEvent(new KeyboardEvent('keydown', { key: '丙', bubbles: true }))
      page.dispatchEvent(new KeyboardEvent('keydown', { key: '丁', bubbles: true }))
    })
    expect(value).toBe('甲丙丁乙')
    act(() => root.unmount())
  })

  it('types into the empty line created by enter', () => {
    let value = '甲'
    const { host, root } = renderEditor(value, {
      onChange: (next: string) => {
        value = next
      },
    })
    const text = host.querySelector('p')?.firstChild as Text
    const range = document.createRange()
    range.setStart(text, 1)
    range.collapse(true)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    const page = host.querySelector('.document-page-editor') as HTMLElement
    act(() => {
      page.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      page.dispatchEvent(new KeyboardEvent('keydown', { key: '乙', bubbles: true }))
    })
    expect(value).toBe('甲\n乙')
    act(() => root.unmount())
  })

  it('writes composed text back when composition ends on the page', () => {
    let value = '甲'
    const { host, root } = renderEditor(value, {
      onChange: (next: string) => {
        value = next
      },
    })
    const text = host.querySelector('p')?.firstChild as Text
    const range = document.createRange()
    range.setStart(text, 1)
    range.collapse(true)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    const page = host.querySelector('.document-page-editor') as HTMLElement
    page.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    const block = host.querySelector('[data-plain-start]') as HTMLElement
    block.textContent = '甲乙'
    page.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    expect(value).toBe('甲乙')
    act(() => root.unmount())
  })

  it('keeps the last in-page selection after focus leaves the page', () => {
    const { host, ref, root } = renderEditor('甲乙')
    const text = host.querySelector('p')?.firstChild as Text
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 1)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    expect(ref.current?.getPlainSelection()).toEqual({ start: 0, end: 1, text: '甲' })
    const input = document.createElement('input')
    document.body.appendChild(input)
    document.getSelection()?.removeAllRanges()
    expect(ref.current?.getPlainSelection()).toEqual({ start: 0, end: 1, text: '甲' })
    act(() => root.unmount())
  })

  it('counts an element caret by the text before that child', () => {
    const { host, root } = renderEditor('甲乙 | 丙')
    const cell = host.querySelector('td') as HTMLElement
    expect(plainOffsetFromNode(host, cell, 1)).toBe(2)
    act(() => root.unmount())
  })

  it('cuts the selected plain text and drops only plain text', () => {
    let value = '甲乙'
    const { host, root } = renderEditor(value, {
      onChange: (next: string) => {
        value = next
      },
    })
    const text = host.querySelector('p')?.firstChild as Text
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 1)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    const page = host.querySelector('.document-page-editor') as HTMLElement
    const cut = new Event('cut', { bubbles: true, cancelable: true }) as ClipboardEvent
    const store: Record<string, string> = {}
    Object.defineProperty(cut, 'clipboardData', {
      value: {
        setData: (type: string, data: string) => {
          store[type] = data
        },
        getData: (type: string) => store[type] ?? '',
      },
    })
    page.dispatchEvent(cut)
    expect(store['text/plain']).toBe('甲')
    expect(value).toBe('乙')
    const drop = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent
    Object.defineProperty(drop, 'dataTransfer', {
      value: {
        getData: (type: string) => (type === 'text/plain' ? '丙' : '<b>丙</b>'),
      },
    })
    page.dispatchEvent(drop)
    expect(value).toBe('丙乙')
    expect(value).not.toContain('<b>')
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
