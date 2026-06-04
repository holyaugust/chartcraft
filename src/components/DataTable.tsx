import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Minus,
  Download,
  ImageDown,
  RotateCcw,
  ArrowRightLeft,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Merge,
  SplitSquareHorizontal,
  ListOrdered,
  Palette,
  LayoutGrid,
} from 'lucide-react'
import type { ApplyChangeOptions } from '../hooks/useUndoableTableState'
import type { CellAlign, CellNumberFormat, CellStyle, TableState } from '../types'
import { createTableState } from '../types'
import FormulaOverlayInput from './FormulaOverlayInput'
import { exportToExcel } from '../utils/excelParser'
import {
  clearSelectionCells,
  extractSelectionPayload,
  getInternalClipboard,
  parseClipboardGrid,
  pasteGridAt,
  readTextFromSystemClipboard,
  serializeGridToTsv,
  setInternalClipboard,
  writeTextToSystemClipboard,
} from '../utils/tableClipboard'
import { exportTableToImage } from '../utils/tableImageExport'
import {
  appendCellReference,
  applyFormulaFill,
  buildFormulaRefColorMap,
  cellAddress,
  colToLetter,
  cycleFormulaReferenceAtCursor,
  getCellDisplayValue,
  getFormulaRefCellStyle,
  isFormula,
  isInFillPreview,
} from '../utils/formulaEngine'
import { formatCellDisplay, NUMBER_FORMAT_LABELS } from '../utils/cellFormat'
import {
  DEFAULT_FONT_ID,
  DEFAULT_FONT_SIZE,
  resolveFontId,
  TABLE_FONT_OPTIONS,
  TABLE_FONT_SIZES,
} from '../utils/tableFonts'
import {
  addTableCol,
  addTableRow,
  findMergeAt,
  getCellAlign,
  getCellStyle,
  getSelectionStyleSnapshot,
  isCellSelected,
  isHiddenByMerge,
  mergeSelection,
  patchSelectionCellStyle,
  removeTableCol,
  removeTableRow,
  selectionSize,
  setSelectionAlign,
  setSelectionNumberFormat,
  transposeTableState,
  unmergeAt,
  type CellSelection,
} from '../utils/tableMeta'
import {
  getTableAppearanceStyle,
  loadTableAppearance,
  saveTableAppearance,
  type TableAppearance,
} from '../utils/tableAppearance'
import { TABLE_STYLES, type TableStyleId } from '../utils/tableStyles'
import { TABLE_THEMES, type TableThemeId } from '../utils/tableThemes'

interface DataTableProps {
  state: TableState
  onChange: (state: TableState, options?: ApplyChangeOptions) => void
  onUndo: () => boolean
  onRedo: () => boolean
  resetEditRef: React.MutableRefObject<(() => void) | null>
  sheetTabs?: React.ReactNode
}

const SAMPLE_DATA = [
  ['月份', '销售额', '利润', '成本'],
  ['1月', '8200', '2100', '6100'],
  ['2月', '9320', '2540', '6780'],
  ['3月', '9010', '2380', '6630'],
  ['4月', '9340', '2890', '6450'],
  ['5月', '12900', '3900', '9000'],
  ['6月', '13300', '4200', '9100'],
]

function buildCellInputStyle(align: CellAlign, cellStyle: CellStyle) {
  return {
    textAlign: align,
    fontFamily: cellStyle.fontFamily,
    fontSize: `${cellStyle.fontSize}px`,
    fontWeight: cellStyle.bold ? 700 : 400,
    fontStyle: cellStyle.italic ? 'oblique' : 'normal',
    textDecoration: cellStyle.underline ? 'underline' : 'none',
  } as const
}

function preventToolbarFocusLoss(e: React.MouseEvent) {
  e.preventDefault()
}

export default function DataTable({
  state,
  onChange,
  onUndo,
  onRedo,
  resetEditRef,
  sheetTabs,
}: DataTableProps) {
  const { data, meta } = state
  const stateRef = useRef(state)
  stateRef.current = state
  const tableRef = useRef<HTMLTableElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const themedRef = useRef<HTMLDivElement>(null)
  const [exportingImage, setExportingImage] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const cellInputRefs = useRef<Record<string, HTMLInputElement>>({})
  const editHistoryStartedRef = useRef(false)
  const editingCellRef = useRef<{ row: number; col: number } | null>(null)
  const [selection, setSelection] = useState<CellSelection | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fillDrag, setFillDrag] = useState<{
    source: { row: number; col: number }
    end: { row: number; col: number }
  } | null>(null)
  const [appearance, setAppearance] = useState<TableAppearance>(loadTableAppearance)

  const tableAppearanceStyle = useMemo(
    () => getTableAppearanceStyle(appearance.theme, appearance.style),
    [appearance],
  )

  const handleThemeChange = useCallback((theme: TableThemeId) => {
    setAppearance((prev) => {
      const next = { ...prev, theme }
      saveTableAppearance(next)
      return next
    })
  }, [])

  const handleStyleChange = useCallback((style: TableStyleId) => {
    setAppearance((prev) => {
      const next = { ...prev, style }
      saveTableAppearance(next)
      return next
    })
  }, [])

  const showSheetAxis = appearance.showSheetAxis !== false

  const handleSheetAxisToggle = useCallback(() => {
    setAppearance((prev) => {
      const next = { ...prev, showSheetAxis: !(prev.showSheetAxis ?? true) }
      saveTableAppearance(next)
      return next
    })
  }, [])

  useEffect(() => {
    editingCellRef.current = editingCell
  }, [editingCell])

  useEffect(() => {
    resetEditRef.current = () => {
      setEditingCell(null)
      setFillDrag(null)
      editHistoryStartedRef.current = false
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
    return () => {
      resetEditRef.current = null
    }
  }, [resetEditRef])

  const activeCell = editingCell ?? (selection ? selection.start : null)

  const isFormulaEditing =
    editingCell !== null &&
    isFormula(data[editingCell.row]?.[editingCell.col] ?? '')

  const refocusEditor = useCallback(() => {
    requestAnimationFrame(() => {
      if (editingCell) {
        cellInputRefs.current[`${editingCell.row},${editingCell.col}`]?.focus()
      }
    })
  }, [editingCell])

  const updateCell = useCallback(
    (row: number, col: number, value: string) => {
      const { data: currentData, meta: currentMeta } = stateRef.current
      const next = {
        data: currentData.map((r, ri) =>
          r.map((c, ci) => (ri === row && ci === col ? value : c)),
        ),
        meta: currentMeta,
      }
      const isEditing = editingCellRef.current !== null
      const skipHistory = isEditing && editHistoryStartedRef.current
      if (isEditing) {
        editHistoryStartedRef.current = true
      }
      onChange(next, skipHistory ? { skipHistory: true } : undefined)
    },
    [onChange],
  )

  const insertCellReference = useCallback(
    (targetRow: number, targetCol: number, extendRange: boolean) => {
      if (!editingCell) return

      const current = data[editingCell.row]?.[editingCell.col] ?? ''
      const ref = cellAddress(targetRow, targetCol)
      updateCell(
        editingCell.row,
        editingCell.col,
        appendCellReference(current, ref, extendRange),
      )
      refocusEditor()
    },
    [data, editingCell, refocusEditor, updateCell],
  )

  const cycleReferenceAtCursor = useCallback(
    (input: HTMLInputElement, row: number, col: number) => {
      const cursorPos = input.selectionStart ?? input.value.length
      const result = cycleFormulaReferenceAtCursor(input.value, cursorPos)
      if (!result) return

      updateCell(row, col, result.formula)
      requestAnimationFrame(() => {
        input.focus()
        input.setSelectionRange(result.cursorPos, result.cursorPos)
      })
    },
    [updateCell],
  )

  const commitEdit = useCallback(
    (moveTo?: { row: number; col: number }) => {
      setEditingCell(null)

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }

      if (moveTo) {
        setSelection({ start: moveTo, end: moveTo })
      }
    },
    [],
  )

  const beginEditing = useCallback(
    (row: number, col: number, initialValue?: string) => {
      if (initialValue !== undefined) {
        updateCell(row, col, initialValue)
      }
      setEditingCell({ row, col })
      setSelection({ start: { row, col }, end: { row, col } })
      requestAnimationFrame(() => {
        const input = cellInputRefs.current[`${row},${col}`]
        input?.focus()
        if (input && initialValue !== undefined) {
          const end = input.value.length
          input.setSelectionRange(end, end)
        }
      })
    },
    [updateCell],
  )

  const clearTableInteraction = useCallback(() => {
    setSelection(null)
    setEditingCell(null)
    setFillDrag(null)
    setIsDragging(false)
    editHistoryStartedRef.current = false
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, [])

  const shouldKeepTableSelection = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return false
    return !!(
      target.closest('.data-table td') ||
      target.closest('.data-table th') ||
      target.closest('.table-toolbar')
    )
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (shouldKeepTableSelection(event.target)) return
      clearTableInteraction()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [clearTableInteraction, shouldKeepTableSelection])

  const handleEditorKeyDown = useCallback(
    (row: number, col: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        onUndo()
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        onRedo()
        return
      }

      if (e.key === 'F4') {
        e.preventDefault()
        cycleReferenceAtCursor(e.currentTarget, row, col)
        return
      }

      const totalCols = data[0]?.length ?? 0

      if (e.key === 'Tab') {
        e.preventDefault()
        const nextCol = e.shiftKey ? col - 1 : col + 1
        commitEdit()
        if (nextCol >= 0 && nextCol < totalCols) {
          beginEditing(row, nextCol)
        } else {
          setSelection({ start: { row, col }, end: { row, col } })
        }
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const nextRow = Math.min(row + 1, data.length - 1)
        commitEdit()
        beginEditing(nextRow, col)
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        commitEdit()
      }
    },
    [beginEditing, commitEdit, cycleReferenceAtCursor, data, onRedo, onUndo],
  )

  const editingFormula = useMemo(() => {
    if (!editingCell) return ''
    const raw = data[editingCell.row]?.[editingCell.col] ?? ''
    return isFormula(raw) ? raw : ''
  }, [editingCell, data])

  const formulaRefColorMap = useMemo(
    () => (editingFormula ? buildFormulaRefColorMap(editingFormula) : new Map<string, number>()),
    [editingFormula],
  )

  const showFormulaRefHighlights = editingFormula.length > 0

  const axisHighlightCell = activeCell ?? (selection ? selection.start : null)
  const axisActiveRow = axisHighlightCell?.row
  const axisActiveCol = axisHighlightCell?.col
  const colCount = data[0]?.length ?? 0

  const isSingleSelection =
    selection !== null &&
    selection.start.row === selection.end.row &&
    selection.start.col === selection.end.col

  const fillSource = isSingleSelection ? selection.start : null
  const showFillHandle =
    fillSource !== null &&
    !editingCell &&
    !isFormulaEditing &&
    !fillDrag &&
    isFormula(data[fillSource.row]?.[fillSource.col] ?? '')

  const handleCellMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    if (isHiddenByMerge(meta, row, col)) return
    if (fillDrag) return

    if (isFormulaEditing && editingCell) {
      const isSameCell = editingCell.row === row && editingCell.col === col
      if (!isSameCell) {
        e.preventDefault()
        insertCellReference(row, col, e.shiftKey)
        return
      }
    }

    if (!isFormulaEditing) {
      e.preventDefault()
    }

    if (e.shiftKey && selection) {
      setSelection({ start: selection.start, end: { row, col } })
    } else {
      setSelection({ start: { row, col }, end: { row, col } })
      setIsDragging(true)
    }

    wrapperRef.current?.focus({ preventScroll: true })
  }

  const handleCellDoubleClick = (row: number, col: number, e: React.MouseEvent) => {
    if (isHiddenByMerge(meta, row, col)) return
    e.preventDefault()
    beginEditing(row, col)
  }

  const handleCellMouseEnter = (row: number, col: number) => {
    if (isHiddenByMerge(meta, row, col)) return

    if (fillDrag) {
      setFillDrag({ ...fillDrag, end: { row, col } })
      return
    }

    if (isFormulaEditing || !isDragging || !selection) return
    setSelection({ start: selection.start, end: { row, col } })
  }

  const handleFillHandleMouseDown = (
    row: number,
    col: number,
    e: React.MouseEvent,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setFillDrag({ source: { row, col }, end: { row, col } })
    setSelection({ start: { row, col }, end: { row, col } })
  }

  const selectEntireColumn = useCallback(
    (col: number) => {
      if (colCount === 0 || data.length === 0) return
      commitEdit()
      setSelection({
        start: { row: 0, col },
        end: { row: data.length - 1, col },
      })
      setIsDragging(false)
    },
    [colCount, data.length, commitEdit],
  )

  const selectEntireRow = useCallback(
    (row: number) => {
      if (colCount === 0) return
      commitEdit()
      setSelection({
        start: { row, col: 0 },
        end: { row, col: colCount - 1 },
      })
      setIsDragging(false)
    },
    [colCount, commitEdit],
  )

  const handleColHeaderMouseDown = (col: number, e: React.MouseEvent) => {
    e.preventDefault()
    selectEntireColumn(col)
  }

  const handleRowHeaderMouseDown = (row: number, e: React.MouseEvent) => {
    e.preventDefault()
    selectEntireRow(row)
  }

  const handleMouseUp = () => {
    if (fillDrag) {
      const { source, end } = fillDrag
      const hasTarget = source.row !== end.row || source.col !== end.col
      if (hasTarget) {
        const newData = applyFormulaFill(data, source.row, source.col, end.row, end.col)
        onChange({ data: newData, meta })
      }
      setFillDrag(null)
    }
    setIsDragging(false)
  }

  const selectionRef = useRef(selection)
  selectionRef.current = selection

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const inTable =
        !!document.activeElement?.closest('.data-table-wrapper') || !!selectionRef.current
      if (!inTable) return

      const currentSelection = selectionRef.current
      const isEditing = editingCellRef.current !== null

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        if (isEditing) return
        if (!currentSelection) return
        event.preventDefault()
        void (async () => {
          const payload = extractSelectionPayload(stateRef.current, currentSelection)
          setInternalClipboard(payload)
          await writeTextToSystemClipboard(serializeGridToTsv(payload.cells))
        })()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') {
        if (isEditing) return
        if (!currentSelection) return
        event.preventDefault()
        void (async () => {
          const payload = extractSelectionPayload(stateRef.current, currentSelection)
          setInternalClipboard(payload)
          await writeTextToSystemClipboard(serializeGridToTsv(payload.cells))
          onChange(clearSelectionCells(stateRef.current, currentSelection))
        })()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        if (isEditing) return
        event.preventDefault()
        void (async () => {
          const anchor = currentSelection?.start ?? { row: 0, col: 0 }
          const internal = getInternalClipboard()
          let payload = internal

          try {
            const text = await readTextFromSystemClipboard()
            if (text.trim()) {
              const externalCells = parseClipboardGrid(text)
              const internalTsv = internal ? serializeGridToTsv(internal.cells) : ''
              const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd()
              const normalizedInternal = internalTsv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd()
              if (internal && normalizedText === normalizedInternal) {
                payload = internal
              } else {
                payload = { cells: externalCells, alignments: {}, cellStyles: {} }
              }
            }
          } catch {
            /* clipboard permission denied */
          }

          if (!payload) return
          onChange(pasteGridAt(stateRef.current, anchor, payload))
        })()
        return
      }

      if (isEditing || !currentSelection) return

      const { row, col } = currentSelection.start
      let nextRow = row
      let nextCol = col

      switch (event.key) {
        case 'ArrowUp':
          nextRow = Math.max(0, row - 1)
          break
        case 'ArrowDown':
          nextRow = Math.min(data.length - 1, row + 1)
          break
        case 'ArrowLeft':
          nextCol = Math.max(0, col - 1)
          break
        case 'ArrowRight':
          nextCol = Math.min(colCount - 1, col + 1)
          break
        case 'Tab':
          event.preventDefault()
          nextCol = event.shiftKey ? Math.max(0, col - 1) : Math.min(colCount - 1, col + 1)
          setSelection({ start: { row, col: nextCol }, end: { row, col: nextCol } })
          return
        case 'Enter':
        case 'F2':
          event.preventDefault()
          beginEditing(row, col)
          return
        case 'Delete':
        case 'Backspace':
          event.preventDefault()
          onChange(clearSelectionCells(stateRef.current, currentSelection))
          return
        default:
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault()
            beginEditing(row, col, event.key)
          }
          return
      }

      if (nextRow !== row || nextCol !== col) {
        event.preventDefault()
        setSelection({ start: { row: nextRow, col: nextCol }, end: { row: nextRow, col: nextCol } })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [beginEditing, colCount, data.length, onChange])

  const applyAlign = (align: CellAlign) => {
    const currentSelection = selectionRef.current
    if (!currentSelection) return
    onChange(setSelectionAlign(stateRef.current, currentSelection, align))
  }

  const applyCellStylePatch = useCallback(
    (patch: Partial<CellStyle> | ((current: CellStyle, row: number, col: number) => Partial<CellStyle>)) => {
      const currentSelection = selectionRef.current
      if (!currentSelection) return
      onChange(patchSelectionCellStyle(stateRef.current, currentSelection, patch))
    },
    [onChange],
  )

  const selectionStyle = useMemo(
    () => getSelectionStyleSnapshot(meta, selection),
    [meta, selection],
  )

  const handleMerge = () => {
    if (!selection || selectionSize(selection) < 2) return
    onChange(mergeSelection(state, selection))
  }

  const handleUnmerge = () => {
    if (!selection) return
    const { row, col } = selection.start
    onChange(unmergeAt(state, row, col))
  }

  const canMerge = selection !== null && selectionSize(selection) >= 2
  const canUnmerge = selection !== null && findMergeAt(meta, selection.start.row, selection.start.col) !== null

  const handleExportExcel = async () => {
    if (exportingExcel) return
    setExportingExcel(true)
    try {
      await exportToExcel(state)
    } catch (err) {
      console.error(err)
      window.alert(err instanceof Error ? err.message : '导出 Excel 失败')
    } finally {
      setExportingExcel(false)
    }
  }

  const handleExportImage = async () => {
    if (!themedRef.current || exportingImage) return
    setExportingImage(true)
    try {
      await exportTableToImage(themedRef.current)
    } catch (err) {
      console.error(err)
      window.alert(err instanceof Error ? err.message : '导出图片失败')
    } finally {
      setExportingImage(false)
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="data-table-wrapper"
      tabIndex={-1}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="table-appearance-panel">
        <div className="table-appearance-section">
          <span className="table-appearance-label">
            <Palette size={14} />
            配色
          </span>
          <div className="table-appearance-grid">
            {TABLE_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`table-theme-btn ${appearance.theme === theme.id ? 'active' : ''}`}
                onClick={() => handleThemeChange(theme.id)}
                title={theme.label}
              >
                <span className="table-theme-swatches">
                  {theme.swatches.map((color) => (
                    <span key={color} style={{ background: color }} />
                  ))}
                </span>
                {theme.label}
              </button>
            ))}
          </div>
        </div>
        <div className="table-appearance-section">
          <span className="table-appearance-label">
            <LayoutGrid size={14} />
            样式
          </span>
          <div className="table-appearance-grid">
            {TABLE_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                className={`table-style-btn ${appearance.style === style.id ? 'active' : ''}`}
                onClick={() => handleStyleChange(style.id)}
                title={style.description}
              >
                <span className="table-style-preview" data-preview-style={style.id} />
                <span className="table-style-btn-text">
                  <span>{style.label}</span>
                  <span className="table-style-btn-desc">{style.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={themedRef}
        className="data-table-themed"
        style={tableAppearanceStyle}
        data-table-theme={appearance.theme}
        data-table-style={appearance.style}
      >
      <div className="table-toolbar">
        <div className="toolbar-group">
          <button
            type="button"
            className="btn btn-sm btn-icon-only"
            onClick={() => onUndo()}
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-icon-only"
            onClick={() => onRedo()}
            title="重做 (Ctrl+Y)"
          >
            <Redo2 size={14} />
          </button>
          <span className="toolbar-divider" />
          <button type="button" className="btn btn-sm" onClick={() => onChange(addTableRow(state))} title="添加行">
            <Plus size={14} /> 行
          </button>
          <button type="button" className="btn btn-sm" onClick={() => onChange(removeTableRow(state))} title="删除行">
            <Minus size={14} /> 行
          </button>
          <button type="button" className="btn btn-sm" onClick={() => onChange(addTableCol(state))} title="添加列">
            <Plus size={14} /> 列
          </button>
          <button type="button" className="btn btn-sm" onClick={() => onChange(removeTableCol(state))} title="删除列">
            <Minus size={14} /> 列
          </button>
        </div>

        <div className="toolbar-group toolbar-font-group">
          <select
            className="toolbar-select toolbar-font-family"
            value={selection ? resolveFontId(selectionStyle?.fontFamily) : DEFAULT_FONT_ID}
            disabled={!selection}
            title="字体"
            onChange={(e) => {
              const font = TABLE_FONT_OPTIONS.find((item) => item.id === e.target.value)
              if (font) applyCellStylePatch({ fontFamily: font.id })
            }}
          >
            {TABLE_FONT_OPTIONS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
          <select
            className="toolbar-select toolbar-font-size"
            value={String(selectionStyle?.fontSize ?? DEFAULT_FONT_SIZE)}
            disabled={!selection}
            title="字号"
            onChange={(e) => applyCellStylePatch({ fontSize: Number(e.target.value) })}
          >
            {TABLE_FONT_SIZES.map((size) => (
              <option key={size} value={String(size)}>
                {size}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`btn btn-sm btn-icon-only${selectionStyle?.bold ? ' btn-toggle-active' : ''}`}
            onMouseDown={preventToolbarFocusLoss}
            onClick={() => applyCellStylePatch((current) => ({ bold: !current.bold }))}
            disabled={!selection}
            title="加粗"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            className={`btn btn-sm btn-icon-only${selectionStyle?.italic ? ' btn-toggle-active' : ''}`}
            onMouseDown={preventToolbarFocusLoss}
            onClick={() => applyCellStylePatch((current) => ({ italic: !current.italic }))}
            disabled={!selection}
            title="倾斜"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            className={`btn btn-sm btn-icon-only${selectionStyle?.underline ? ' btn-toggle-active' : ''}`}
            onMouseDown={preventToolbarFocusLoss}
            onClick={() => applyCellStylePatch((current) => ({ underline: !current.underline }))}
            disabled={!selection}
            title="下划线"
          >
            <Underline size={14} />
          </button>
          <select
            className="toolbar-select toolbar-number-format"
            value={selectionStyle?.numberFormat ?? 'general'}
            disabled={!selection}
            title="单元格格式"
            onChange={(e) => {
              const currentSelection = selectionRef.current
              if (!currentSelection) return
              onChange(
                setSelectionNumberFormat(
                  stateRef.current,
                  currentSelection,
                  e.target.value as CellNumberFormat,
                ),
              )
            }}
          >
            {(Object.keys(NUMBER_FORMAT_LABELS) as CellNumberFormat[]).map((format) => (
              <option key={format} value={format}>
                {NUMBER_FORMAT_LABELS[format]}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-group">
          <button
            type="button"
            className="btn btn-sm btn-icon-only"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyAlign('left')}
            disabled={!selection}
            title="左对齐"
          >
            <AlignLeft size={14} />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-icon-only"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyAlign('center')}
            disabled={!selection}
            title="居中对齐"
          >
            <AlignCenter size={14} />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-icon-only"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyAlign('right')}
            disabled={!selection}
            title="右对齐"
          >
            <AlignRight size={14} />
          </button>
          <span className="toolbar-divider" />
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={handleMerge}
            disabled={!canMerge}
            title="合并单元格"
          >
            <Merge size={14} /> 合并
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={handleUnmerge}
            disabled={!canUnmerge}
            title="取消合并"
          >
            <SplitSquareHorizontal size={14} /> 拆分
          </button>
        </div>

        <div className="toolbar-group">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={handleSheetAxisToggle}
            title={showSheetAxis ? '隐藏行列标号（A/B/C、1/2/3）' : '显示行列标号'}
          >
            <ListOrdered size={14} /> {showSheetAxis ? '隐藏标号' : '显示标号'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => onChange(transposeTableState(state))}
            title="将行与列互换"
          >
            <ArrowRightLeft size={14} /> 切换行列
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => onChange(createTableState(SAMPLE_DATA.map((r) => [...r])))}
          >
            <RotateCcw size={14} /> 示例数据
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            title="选择保存位置并导出 Excel"
          >
            <Download size={14} /> {exportingExcel ? '导出中…' : '导出 Excel'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={handleExportImage}
            disabled={exportingImage}
            title="选择保存位置并导出 PNG 图片"
          >
            <ImageDown size={14} /> {exportingImage ? '导出中…' : '导出图片'}
          </button>
        </div>
      </div>

      <div className={`table-sheet-frame${sheetTabs ? ' has-sheet-tabs' : ''}`}>
      <div className="table-scroll">
        <table
          ref={tableRef}
          className={`data-table${showSheetAxis ? '' : ' sheet-axis-hidden'}`}
        >
          <thead>
            <tr>
              <th className="sheet-corner" aria-hidden="true" />
              {Array.from({ length: colCount }, (_, colIdx) => (
                <th
                  key={`col-${colIdx}`}
                  className={`sheet-col-header${axisActiveCol === colIdx ? ' sheet-axis-active' : ''}`}
                  data-col-accent={String(colIdx % 6)}
                  title={`选中整列 ${colToLetter(colIdx)}`}
                  onMouseDown={(e) => handleColHeaderMouseDown(colIdx, e)}
                >
                  {colToLetter(colIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={
                  rowIdx === 0
                    ? 'table-row-title'
                    : `table-row-data ${rowIdx % 2 === 1 ? 'table-row-odd' : 'table-row-even'}`
                }
              >
                <th
                  className={`sheet-row-header${axisActiveRow === rowIdx ? ' sheet-axis-active' : ''}`}
                  title={`选中整行 ${rowIdx + 1}`}
                  onMouseDown={(e) => handleRowHeaderMouseDown(rowIdx, e)}
                >
                  {rowIdx + 1}
                </th>
                {row.map((cell, colIdx) => {
                  if (isHiddenByMerge(meta, rowIdx, colIdx)) return null

                  const merge = findMergeAt(meta, rowIdx, colIdx)
                  const isAnchor = merge?.row === rowIdx && merge?.col === colIdx
                  const align = getCellAlign(meta, rowIdx, colIdx)
                  const cellStyle = getCellStyle(meta, rowIdx, colIdx)
                  const inputStyle = buildCellInputStyle(align, cellStyle)
                  const selected = isCellSelected(selection, rowIdx, colIdx)
                  const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx
                  const isPickTarget = isFormulaEditing && !isEditing
                  const hasFormula = isFormula(cell)
                  const isEditingThis = isEditing
                  const displayValue = isEditingThis
                    ? cell
                    : formatCellDisplay(
                        getCellDisplayValue(data, rowIdx, colIdx),
                        cellStyle.numberFormat ?? 'general',
                      )
                  const inputKey = `${rowIdx},${colIdx}`

                  const inFillPreview = fillDrag ? isInFillPreview(fillDrag, rowIdx, colIdx) : false
                  const isFillSource =
                    fillDrag?.source.row === rowIdx && fillDrag?.source.col === colIdx
                  const showHandle =
                    showFillHandle && fillSource?.row === rowIdx && fillSource?.col === colIdx

                  const refColorIndex = showFormulaRefHighlights
                    ? formulaRefColorMap.get(`${rowIdx},${colIdx}`)
                    : undefined
                  const refHighlightStyle =
                    refColorIndex !== undefined ? getFormulaRefCellStyle(refColorIndex) : undefined

                  const isFormulaEditingThis = isEditingThis && isFormula(cell)
                  const axisAsColHeader = !showSheetAxis && rowIdx === 0
                  const axisAsRowHeader = !showSheetAxis && colIdx === 0 && rowIdx > 0
                  const axisAsCorner = !showSheetAxis && rowIdx === 0 && colIdx === 0

                  return (
                    <td
                      key={colIdx}
                      rowSpan={isAnchor && merge ? merge.rowSpan : undefined}
                      colSpan={isAnchor && merge ? merge.colSpan : undefined}
                      style={refHighlightStyle}
                      data-col-accent={axisAsColHeader ? String(colIdx % 6) : undefined}
                      data-cell-align={align}
                      data-cell-italic={cellStyle.italic ? 'true' : undefined}
                      className={[
                        rowIdx > 0 && colIdx === 0 ? 'cell-label-col' : '',
                        rowIdx > 0 && colIdx > 0 ? 'cell-data-col' : '',
                        axisAsColHeader ? 'axis-as-col-header' : '',
                        axisAsRowHeader ? 'axis-as-row-header' : '',
                        axisAsCorner ? 'axis-as-corner' : '',
                        axisAsColHeader && axisActiveCol === colIdx ? 'sheet-axis-active' : '',
                        axisAsRowHeader && axisActiveRow === rowIdx ? 'sheet-axis-active' : '',
                        selected && !isFormulaEditingThis ? 'cell-selected' : '',
                        inFillPreview ? 'cell-fill-preview' : '',
                        isFillSource ? 'cell-fill-source' : '',
                        isPickTarget ? 'cell-pick-target' : '',
                        hasFormula && !isEditing ? 'cell-formula' : '',
                        displayValue.startsWith('#') ? 'cell-error' : '',
                        refColorIndex !== undefined ? 'cell-ref-highlight' : '',
                        isFormulaEditingThis ? 'cell-formula-editing' : '',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined}
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, colIdx, e)}
                      onDoubleClick={(e) => handleCellDoubleClick(rowIdx, colIdx, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
                    >
                      <FormulaOverlayInput
                        inputRef={(el) => {
                          if (el) cellInputRefs.current[inputKey] = el
                          else delete cellInputRefs.current[inputKey]
                        }}
                        className={`cell-input ${rowIdx === 0 ? 'header-input' : ''} ${colIdx === 0 && rowIdx > 0 ? 'label-cell' : ''} ${colIdx > 0 && rowIdx > 0 ? 'value-cell' : ''}${cellStyle.italic ? ' cell-italic' : ''}${cellStyle.underline ? ' cell-underline' : ''}`}
                        wrapClassName={`cell-input-wrap${cellStyle.italic ? ' cell-text-italic' : ''}`}
                        highlightClassName="cell-formula-highlight"
                        style={inputStyle}
                        highlightStyle={inputStyle}
                        value={isEditingThis ? cell : displayValue}
                        readOnly={!isEditingThis}
                        tabIndex={isEditingThis ? 0 : -1}
                        onChange={(value) => updateCell(rowIdx, colIdx, value)}
                        onKeyDown={(e) => handleEditorKeyDown(rowIdx, colIdx, e)}
                        onFocus={() => {
                          setEditingCell({ row: rowIdx, col: colIdx })
                          editHistoryStartedRef.current = false
                        }}
                        onBlur={() => {
                          setEditingCell((current) =>
                            current?.row === rowIdx && current.col === colIdx ? null : current,
                          )
                          editHistoryStartedRef.current = false
                        }}
                      />
                      {showHandle && (
                        <span
                          className="fill-handle"
                          title="拖拽填充公式"
                          onMouseDown={(e) => handleFillHandleMouseDown(rowIdx, colIdx, e)}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sheetTabs ? <div className="workbook-sheet-bar">{sheetTabs}</div> : null}
      </div>
      </div>
    </div>
  )
}
