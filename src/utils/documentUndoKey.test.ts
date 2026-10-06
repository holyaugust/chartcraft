import { describe, expect, it } from 'vitest'
import { resolveDocumentUndoKey } from './documentUndoKey'

function eventTarget(className: string, tag = 'DIV') {
  const el = document.createElement(tag)
  el.className = className
  document.body.appendChild(el)
  return el
}

describe('resolveDocumentUndoKey', () => {
  it('blocks browser undo on the page when the snapshot stack is empty', () => {
    const target = eventTarget('document-page-editor')
    expect(
      resolveDocumentUndoKey({
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        key: 'z',
        target,
        undoCount: 0,
      }),
    ).toBe('blocked')
  })

  it('undoes when the page has a snapshot', () => {
    const target = eventTarget('document-page-editor')
    expect(
      resolveDocumentUndoKey({
        ctrlKey: false,
        metaKey: true,
        shiftKey: false,
        key: 'z',
        target,
        undoCount: 1,
      }),
    ).toBe('undo')
  })

  it('ignores inputs and foreign textareas', () => {
    expect(
      resolveDocumentUndoKey({
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        key: 'z',
        target: eventTarget('', 'INPUT'),
        undoCount: 1,
      }),
    ).toBe('ignore')
    expect(
      resolveDocumentUndoKey({
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        key: 'z',
        target: eventTarget('refine-prompt', 'TEXTAREA'),
        undoCount: 1,
      }),
    ).toBe('ignore')
  })
})
