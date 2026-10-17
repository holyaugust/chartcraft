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
  return {
    showTextTab: false,
    showOfficialTab: false,
    showOriginalWordLink: hasOriginalWord,
  }
}
