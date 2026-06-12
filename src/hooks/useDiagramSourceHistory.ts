import { useCallback, useRef, useState } from 'react'

const MAX_HISTORY = 50
const SOURCE_EDIT_DEBOUNCE_MS = 700

export function useDiagramSourceHistory(initialSource: string) {
  const [source, setSourceState] = useState(initialSource)
  const sourceRef = useRef(initialSource)
  const pastRef = useRef<string[]>([])
  const futureRef = useRef<string[]>([])
  const applyingHistoryRef = useRef(false)
  const sourceEditBaseRef = useRef<string | null>(null)
  const sourceEditTimerRef = useRef<number | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const syncFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0)
    setCanRedo(futureRef.current.length > 0)
  }, [])

  const pushPast = useCallback(
    (snapshot: string) => {
      pastRef.current.push(snapshot)
      if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift()
      futureRef.current = []
      syncFlags()
    },
    [syncFlags],
  )

  const setSource = useCallback(
    (value: string | ((prev: string) => string)) => {
      const prev = sourceRef.current
      const next = typeof value === 'function' ? value(prev) : value
      if (next === prev) return

      if (!applyingHistoryRef.current) {
        pushPast(prev)
      }

      sourceRef.current = next
      setSourceState(next)
    },
    [pushPast],
  )

  const setSourceDebounced = useCallback(
    (next: string) => {
      if (sourceEditBaseRef.current === null) {
        sourceEditBaseRef.current = sourceRef.current
      }

      sourceRef.current = next
      setSourceState(next)

      if (sourceEditTimerRef.current != null) {
        window.clearTimeout(sourceEditTimerRef.current)
      }

      sourceEditTimerRef.current = window.setTimeout(() => {
        sourceEditTimerRef.current = null
        const base = sourceEditBaseRef.current
        sourceEditBaseRef.current = null
        if (base != null && base !== sourceRef.current) {
          pastRef.current.push(base)
          if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift()
          futureRef.current = []
          syncFlags()
        }
      }, SOURCE_EDIT_DEBOUNCE_MS)
    },
    [syncFlags],
  )

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return false

    if (sourceEditTimerRef.current != null) {
      window.clearTimeout(sourceEditTimerRef.current)
      sourceEditTimerRef.current = null
      sourceEditBaseRef.current = null
    }

    applyingHistoryRef.current = true
    const current = sourceRef.current
    const previous = pastRef.current.pop()!
    futureRef.current.push(current)
    sourceRef.current = previous
    setSourceState(previous)
    applyingHistoryRef.current = false
    syncFlags()
    return true
  }, [syncFlags])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return false

    if (sourceEditTimerRef.current != null) {
      window.clearTimeout(sourceEditTimerRef.current)
      sourceEditTimerRef.current = null
      sourceEditBaseRef.current = null
    }

    applyingHistoryRef.current = true
    const current = sourceRef.current
    const next = futureRef.current.pop()!
    pastRef.current.push(current)
    sourceRef.current = next
    setSourceState(next)
    applyingHistoryRef.current = false
    syncFlags()
    return true
  }, [syncFlags])

  const resetHistory = useCallback(
    (nextSource: string) => {
      if (sourceEditTimerRef.current != null) {
        window.clearTimeout(sourceEditTimerRef.current)
        sourceEditTimerRef.current = null
      }
      sourceEditBaseRef.current = null
      pastRef.current = []
      futureRef.current = []
      sourceRef.current = nextSource
      setSourceState(nextSource)
      syncFlags()
    },
    [syncFlags],
  )

  return {
    source,
    setSource,
    setSourceDebounced,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
  }
}
