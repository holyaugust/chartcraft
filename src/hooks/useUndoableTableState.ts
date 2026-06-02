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
  const stateRef = useRef(state)
  stateRef.current = state

  const applyChange = useCallback((next: TableState, options?: ApplyChangeOptions) => {
    if (statesEqual(next, stateRef.current)) return

    if (!options?.skipHistory) {
      pastRef.current.push(cloneState(stateRef.current))
      if (pastRef.current.length > MAX_HISTORY) {
        pastRef.current.shift()
      }
    }

    stateRef.current = next
    setState(next)
  }, [])

  const undo = useCallback(() => {
    const previous = pastRef.current.pop()
    if (!previous) return false
    stateRef.current = previous
    setState(previous)
    return true
  }, [])

  const canUndo = useCallback(() => pastRef.current.length > 0, [])

  return { state, applyChange, undo, canUndo }
}

export function useTableUndoShortcut(
  undo: () => boolean,
  onAfterUndo?: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return

    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'z' || event.shiftKey) return
      if (!event.ctrlKey && !event.metaKey) return

      const target = event.target as HTMLElement | null
      const inTable = !!target?.closest('.data-table-wrapper')

      const ok = undo()
      if (ok) {
        event.preventDefault()
        event.stopPropagation()
        onAfterUndo?.()
        return
      }

      // 在表格区域内拦截 Ctrl+Z，避免输入框原生撤销与表格状态不同步
      if (inTable) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [undo, onAfterUndo, enabled])
}
