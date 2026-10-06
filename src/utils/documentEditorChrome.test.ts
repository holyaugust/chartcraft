import { describe, expect, it } from 'vitest'
import { documentEditorChrome } from './documentEditorChrome'

describe('documentEditorChrome', () => {
  it('hides layout tabs during structure梳理', () => {
    expect(documentEditorChrome('structure', false)).toEqual({
      showTextTab: false,
      showOfficialTab: false,
      showOriginalWordLink: false,
    })
  })

  it('offers a secondary original-Word link on structure when a file was uploaded', () => {
    expect(documentEditorChrome('structure', true)).toEqual({
      showTextTab: false,
      showOfficialTab: false,
      showOriginalWordLink: true,
    })
  })

  it('keeps text and 公文版式 tabs on 智能排版', () => {
    expect(documentEditorChrome('format', false)).toEqual({
      showTextTab: true,
      showOfficialTab: true,
      showOriginalWordLink: false,
    })
  })

  it('adds original-Word compare on 智能排版 when a file was uploaded', () => {
    expect(documentEditorChrome('format', true).showOriginalWordLink).toBe(true)
    expect(documentEditorChrome('format', true).showOfficialTab).toBe(true)
  })

  it('hides 公文版式 on proofread and export', () => {
    expect(documentEditorChrome('proofread', true)).toMatchObject({
      showOfficialTab: false,
      showOriginalWordLink: true,
    })
    expect(documentEditorChrome('export', true).showOfficialTab).toBe(false)
  })
})
