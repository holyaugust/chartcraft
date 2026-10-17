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

  it('uses one editable 公文版式 surface on 智能排版 without a text tab', () => {
    expect(documentEditorChrome('format', false)).toEqual({
      showTextTab: false,
      showOfficialTab: false,
      showOriginalWordLink: false,
    })
  })

  it('adds original-Word compare on 智能排版 when a file was uploaded', () => {
    expect(documentEditorChrome('format', true)).toEqual({
      showTextTab: false,
      showOfficialTab: false,
      showOriginalWordLink: true,
    })
  })

  it('hides layout tabs on proofread and export', () => {
    expect(documentEditorChrome('proofread', true)).toMatchObject({
      showOfficialTab: false,
      showOriginalWordLink: true,
    })
    expect(documentEditorChrome('export', true).showOfficialTab).toBe(false)
  })
})
