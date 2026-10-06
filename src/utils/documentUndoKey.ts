export function resolveDocumentUndoKey(args: {
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  key: string
  target: EventTarget | null
  undoCount: number
}): 'ignore' | 'blocked' | 'undo' {
  if (!(args.ctrlKey || args.metaKey) || args.shiftKey || args.key.toLowerCase() !== 'z') return 'ignore'
  const element = args.target instanceof Element ? args.target : null
  if (!element) return 'ignore'
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return 'ignore'
  if (!element.closest('.document-page-editor')) return 'ignore'
  return args.undoCount > 0 ? 'undo' : 'blocked'
}
