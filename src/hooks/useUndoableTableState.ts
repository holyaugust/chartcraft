import { useCallback, useEffect, useRef, useState } from 'react'
import type { TableState } from '../types'

const MAX_HISTORY = 100

export type ApplyChangeOptions = {
  skipHistory?: boolean
}

function cloneState(state: TableState): TableState {
  return JSON.parse(JSON.stringify(state)) as TableState
}

function statesEqual(a: TableState, b: TableState): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function useUndoableTableState(initial: TableState) {
  const [state, setState] = useState(initial)
  const pastRef = useRef<TableState[]>([])
  const futureRef = useRef<TableState[]>([])
  const stateRef = useRef(state)
  stateRef.current = state

  const applyChange = useCallback((next: TableState, options?: ApplyChangeOptions) => {
    if (statesEqual(next, stateRef.current)) return

    if (!options?.skipHistory) {
      pastRef.current.push(cloneState(stateRef.current))
      if (pastRef.current.length > MAX_HISTORY) {
        pastRef.current.shift()
      }
      futureRef.current = []
    }

    stateRef.current = next
    setState(next)
  }, [])

  const undo = useCallback(() => {
    const previous = pastRef.current.pop()
    if (!previous) return false
    futureRef.current.push(cloneState(stateRef.current))
    stateRef.current = previous
    setState(previous)
    return true
  }, [])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return false
    pastRef.current.push(cloneState(stateRef.current))
    stateRef.current = next
    setState(next)
    return true
  }, [])

  const canUndo = useCallback(() => pastRef.current.length > 0, [])
  const canRedo = useCallback(() => futureRef.current.length > 0, [])

  const resetHistory = useCallback((next: TableState) => {
    pastRef.current = []
    futureRef.current = []
    stateRef.current = next
    setState(next)
  }, [])

  return { state, applyChange, undo, redo, canUndo, canRedo, resetHistory }
}

export function useTableHistoryShortcuts(
  undo: () => boolean,
  redo: () => boolean,
  onAfterHistory?: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return

    const handler = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return

      const key = event.key.toLowerCase()
      const target = event.target as HTMLElement | null
      const inTable = !!target?.closest('.data-table-wrapper')

      if (key === 'z' && !event.shiftKey) {
        const ok = undo()
        if (ok) {
          event.preventDefault()
          event.stopPropagation()
          onAfterHistory?.()
          return
        }
        if (inTable) {
          event.preventDefault()
          event.stopPropagation()
        }
        return
      }

      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        const ok = redo()
        if (ok) {
          event.preventDefault()
          event.stopPropagation()
          onAfterHistory?.()
        }
      }
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [undo, redo, onAfterHistory, enabled])
}

/** @deprecated 使用 useTableHistoryShortcuts */
export function useTableUndoShortcut(
  undo: () => boolean,
  onAfterUndo?: () => void,
  enabled = true,
) {
  useTableHistoryShortcuts(undo, () => false, onAfterUndo, enabled)
}
