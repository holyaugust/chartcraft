export const SELECTION_REFINE_HINT_KEY = 'chartcraft-selection-refine-hint-dismissed'

export function loadSelectionRefineHintDismissed(): boolean {
  try {
    return localStorage.getItem(SELECTION_REFINE_HINT_KEY) === '1'
  } catch {
    return false
  }
}

export function saveSelectionRefineHintDismissed(): void {
  try {
    localStorage.setItem(SELECTION_REFINE_HINT_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function shouldShowSelectionRefineHint(input: {
  dismissed: boolean
  hasContent: boolean
  viewMode: string
  workflowStep: string
  hasSelection: boolean
}): boolean {
  if (input.dismissed) return false
  if (!input.hasContent) return false
  if (input.viewMode !== 'text') return false
  if (input.workflowStep === 'prepare') return false
  if (input.hasSelection) return false
  return true
}
