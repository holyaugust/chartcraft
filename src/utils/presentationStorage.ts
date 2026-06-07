const PRESENTATION_DRAFT_KEY = 'chartcraft-presentation-draft'

export interface PresentationDraft {
  templateId: string
  previewText: string
  outlineJson: string
  prompt: string
  uploadedPptxFileName?: string
}

const DEFAULT_DRAFT: PresentationDraft = {
  templateId: 'ppt-gongzuo-huibao',
  previewText: '',
  outlineJson: '',
  prompt: '',
}

export function loadPresentationDraft(): PresentationDraft {
  try {
    const raw = localStorage.getItem(PRESENTATION_DRAFT_KEY)
    if (!raw) return { ...DEFAULT_DRAFT }
    const parsed = JSON.parse(raw) as Partial<PresentationDraft>
    return {
      ...DEFAULT_DRAFT,
      ...parsed,
      uploadedPptxFileName: parsed.uploadedPptxFileName,
    }
  } catch {
    return { ...DEFAULT_DRAFT }
  }
}

export function savePresentationDraft(draft: PresentationDraft): void {
  try {
    localStorage.setItem(PRESENTATION_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

export const DOCUMENT_DRAFT_KEY = 'chartcraft-document-draft'

export function loadDocumentDraftForPresentation(): string {
  try {
    return localStorage.getItem(DOCUMENT_DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}
