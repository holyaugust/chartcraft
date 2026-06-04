import { useCallback, useRef, useState } from 'react'
import type { TableState } from '../types'
import {
  createBlankSheetState,
  createWorkbookFromSheets,
  generateSheetName,
  getActiveTableState,
  isSheetNameTaken,
  newSheetId,
  type WorkbookState,
} from '../types/workbook'

const MAX_HISTORY = 100

export type ApplyChangeOptions = {
  skipHistory?: boolean
}

type SheetHistory = {
  past: TableState[]
  future: TableState[]
}

function cloneState(state: TableState): TableState {
  return JSON.parse(JSON.stringify(state)) as TableState
}

function statesEqual(a: TableState, b: TableState): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function useWorkbookState(initial: WorkbookState) {
  const [workbook, setWorkbook] = useState(initial)
  const workbookRef = useRef(workbook)
  workbookRef.current = workbook
  const historyRef = useRef<Map<string, SheetHistory>>(new Map())

  const applyChange = useCallback((next: TableState, options?: ApplyChangeOptions) => {
    const wb = workbookRef.current
    const id = wb.activeSheetId
    const current = wb.sheets.find((sheet) => sheet.id === id)?.state
    if (!current || statesEqual(current, next)) return

    if (!options?.skipHistory) {
      const history = historyRef.current.get(id) ?? { past: [], future: [] }
      history.past.push(cloneState(current))
      if (history.past.length > MAX_HISTORY) {
        history.past.shift()
      }
      history.future = []
      historyRef.current.set(id, history)
    }

    setWorkbook((prev) => ({
      ...prev,
      sheets: prev.sheets.map((sheet) =>
        sheet.id === id ? { ...sheet, state: next } : sheet,
      ),
    }))
  }, [])

  const setActiveSheet = useCallback((id: string) => {
    if (!workbookRef.current.sheets.some((sheet) => sheet.id === id)) return
    setWorkbook((prev) => ({ ...prev, activeSheetId: id }))
  }, [])

  const replaceWorkbook = useCallback((entries: { name: string; state: TableState }[]) => {
    historyRef.current.clear()
    setWorkbook(createWorkbookFromSheets(entries))
  }, [])

  const addSheet = useCallback((name?: string) => {
    const wb = workbookRef.current
    const sheetName =
      name?.trim() || generateSheetName(wb.sheets.map((sheet) => sheet.name))
    const id = newSheetId()
    const nextSheet = {
      id,
      name: sheetName,
      state: createBlankSheetState(),
    }
    historyRef.current.set(id, { past: [], future: [] })
    setWorkbook((prev) => ({
      sheets: [...prev.sheets, nextSheet],
      activeSheetId: id,
    }))
    return id
  }, [])

  const deleteSheet = useCallback((id: string) => {
    const wb = workbookRef.current
    if (wb.sheets.length <= 1) return false

    historyRef.current.delete(id)
    setWorkbook((prev) => {
      const index = prev.sheets.findIndex((sheet) => sheet.id === id)
      if (index < 0) return prev

      const sheets = prev.sheets.filter((sheet) => sheet.id !== id)
      let activeSheetId = prev.activeSheetId
      if (prev.activeSheetId === id) {
        const nextIndex = Math.min(index, sheets.length - 1)
        activeSheetId = sheets[nextIndex]?.id ?? sheets[0].id
      }
      return { sheets, activeSheetId }
    })
    return true
  }, [])

  const renameSheet = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return false

    const wb = workbookRef.current
    if (isSheetNameTaken(wb.sheets, trimmed, id)) return false

    setWorkbook((prev) => ({
      ...prev,
      sheets: prev.sheets.map((sheet) =>
        sheet.id === id ? { ...sheet, name: trimmed } : sheet,
      ),
    }))
    return true
  }, [])

  const undo = useCallback(() => {
    const wb = workbookRef.current
    const id = wb.activeSheetId
    const history = historyRef.current.get(id)
    if (!history || history.past.length === 0) return false

    const current = wb.sheets.find((sheet) => sheet.id === id)?.state
    if (!current) return false

    const previous = history.past.pop()!
    history.future.push(cloneState(current))
    setWorkbook((prev) => ({
      ...prev,
      sheets: prev.sheets.map((sheet) =>
        sheet.id === id ? { ...sheet, state: previous } : sheet,
      ),
    }))
    return true
  }, [])

  const redo = useCallback(() => {
    const wb = workbookRef.current
    const id = wb.activeSheetId
    const history = historyRef.current.get(id)
    if (!history || history.future.length === 0) return false

    const current = wb.sheets.find((sheet) => sheet.id === id)?.state
    if (!current) return false

    const next = history.future.pop()!
    history.past.push(cloneState(current))
    setWorkbook((prev) => ({
      ...prev,
      sheets: prev.sheets.map((sheet) =>
        sheet.id === id ? { ...sheet, state: next } : sheet,
      ),
    }))
    return true
  }, [])

  const activeState = getActiveTableState(workbook)

  return {
    workbook,
    activeState,
    applyChange,
    setActiveSheet,
    replaceWorkbook,
    addSheet,
    deleteSheet,
    renameSheet,
    undo,
    redo,
  }
}
