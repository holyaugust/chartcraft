export interface DocumentEditorChrome {
  showTextTab: boolean
  showOfficialTab: boolean
  showOriginalWordLink: boolean
}

export function documentEditorChrome(
  step: 'prepare' | 'structure' | 'proofread' | 'format' | 'export',
  hasOriginalWord: boolean,
): DocumentEditorChrome {
  if (step === 'prepare') {
    return { showTextTab: false, showOfficialTab: false, showOriginalWordLink: false }
  }
  if (step === 'format') {
    return {
      showTextTab: true,
      showOfficialTab: true,
      showOriginalWordLink: hasOriginalWord,
    }
  }
  return {
    showTextTab: false,
    showOfficialTab: false,
    showOriginalWordLink: hasOriginalWord,
  }
}
