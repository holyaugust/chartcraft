import { useCallback, useEffect, useRef, useState } from 'react'
import type { TableState } from '../types'

const MAX_HISTORY = 50

function cloneState(state: TableState): TableState {
  return JSON.parse(JSON.stringify(state)) as TableState
}

export function useUndoableTableState(initial: TableState) {
  const [state, setState] = useState(initial)
  const pastRef = useRef<TableState[]>([])
  const stateRef = useRef(state)
  stateRef.current = state

  const pushSnapshot = useCallback(() => {
    pastRef.current.push(cloneState(stateRef.current))
    if (pastRef.current.length > MAX_HISTORY) {
      pastRef.current.shift()
    }
  }, [])

  const setTableState = useCallback((next: TableState) => {
    setState(next)
  }, [])

  const undo = useCallback(() => {
    const previous = pastRef.current.pop()
    if (!previous) return false
    setState(previous)
    return true
  }, [])

  return { state, setTableState, pushSnapshot, undo }
}

export function useTableUndoShortcut(undo: () => boolean) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'z' || event.shiftKey) return
      if (!event.ctrlKey && !event.metaKey) return

      const target = event.target as HTMLElement | null
      if (!target?.closest('.data-table-wrapper')) return

      if (undo()) {
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo])
}
