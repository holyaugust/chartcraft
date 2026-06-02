import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Minus,
  Download,
  RotateCcw,
  ArrowRightLeft,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Merge,
  SplitSquareHorizontal,
} from 'lucide-react'
import type { ApplyChangeOptions } from '../hooks/useUndoableTableState'
import type { CellAlign, TableState } from '../types'
import { createTableState } from '../types'
import FormulaBarEditor from './FormulaBarEditor'
import FormulaOverlayInput from './FormulaOverlayInput'
import { exportToExcel } from '../utils/excelParser'
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
import {
  addTableCol,
  addTableRow,
  findMergeAt,
  getCellAlign,
  isCellSelected,
  isHiddenByMerge,
  mergeSelection,
  removeTableCol,
  removeTableRow,
  selectionSize,
  setSelectionAlign,
  transposeTableState,
  unmergeAt,
  type CellSelection,
} from '../utils/tableMeta'

interface DataTableProps {
  state: TableState
  onChange: (state: TableState, options?: ApplyChangeOptions) => void
  onUndo: () => boolean
  resetEditRef: React.MutableRefObject<(() => void) | null>
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

export default function DataTable({ state, onChange, onUndo, resetEditRef }: DataTableProps) {
  const { data, meta } = state
  const stateRef = useRef(state)
  stateRef.current = state
  const tableRef = useRef<HTMLTableElement>(null)
  const formulaBarRef = useRef<HTMLInputElement>(null)
  const cellInputRefs = useRef<Record<string, HTMLInputElement>>({})
  const editHistoryStartedRef = useRef(false)
  const editingCellRef = useRef<{ row: number; col: number } | null>(null)
  const formulaBarFocusedRef = useRef(false)
  const [selection, setSelection] = useState<CellSelection | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [formulaBarFocused, setFormulaBarFocused] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [fillDrag, setFillDrag] = useState<{
    source: { row: number; col: number }
    end: { row: number; col: number }
  } | null>(null)

  useEffect(() => {
    editingCellRef.current = editingCell
  }, [editingCell])

  useEffect(() => {
    formulaBarFocusedRef.current = formulaBarFocused
  }, [formulaBarFocused])

  useEffect(() => {
    resetEditRef.current = () => {
      setEditingCell(null)
      setFormulaBarFocused(false)
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

  const formulaEditTarget = formulaBarFocused ? activeCell : editingCell

  const isFormulaEditing =
    formulaEditTarget !== null &&
    isFormula(data[formulaEditTarget.row]?.[formulaEditTarget.col] ?? '')

  const refocusEditor = useCallback(() => {
    requestAnimationFrame(() => {
      if (formulaBarFocused) {
        formulaBarRef.current?.focus()
        return
      }
      if (editingCell) {
        cellInputRefs.current[`${editingCell.row},${editingCell.col}`]?.focus()
      }
    })
  }, [editingCell, formulaBarFocused])

  const updateCell = useCallback(
    (row: number, col: number, value: string) => {
      const { data: currentData, meta: currentMeta } = stateRef.current
      const next = {
        data: currentData.map((r, ri) =>
          r.map((c, ci) => (ri === row && ci === col ? value : c)),
        ),
        meta: currentMeta,
      }
      const isEditing = editingCellRef.current !== null || formulaBarFocusedRef.current
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
      setFormulaBarFocused(false)

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }

      if (moveTo) {
        setSelection({ start: moveTo, end: moveTo })
      }
    },
    [],
  )

  const handleEditorKeyDown = useCallback(
    (row: number, col: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        onUndo()
        return
      }

      if (e.key === 'F4') {
        e.preventDefault()
        cycleReferenceAtCursor(e.currentTarget, row, col)
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const nextRow = Math.min(row + 1, data.length - 1)
        commitEdit({ row: nextRow, col })
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        commitEdit()
      }
    },
    [commitEdit, cycleReferenceAtCursor, data.length, onUndo],
  )

  const formulaBarValue = useMemo(() => {
    if (!activeCell) return ''
    return data[activeCell.row]?.[activeCell.col] ?? ''
  }, [activeCell, data])

  const editingFormula = useMemo(() => {
    const target = formulaBarFocused ? activeCell : editingCell
    if (!target) return ''
    const raw = data[target.row]?.[target.col] ?? ''
    return isFormula(raw) ? raw : ''
  }, [formulaBarFocused, activeCell, editingCell, data])

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

    if (e.shiftKey && selection) {
      setSelection({ start: selection.start, end: { row, col } })
    } else {
      setSelection({ start: { row, col }, end: { row, col } })
      setIsDragging(true)
    }
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

  const applyAlign = (align: CellAlign) => {
    if (!selection) return
    onChange(setSelectionAlign(state, selection, align))
  }

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

  return (
    <div className="data-table-wrapper" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="table-toolbar">
        <div className="toolbar-group">
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

        <div className="toolbar-group">
          <button
            type="button"
            className="btn btn-sm btn-icon-only"
            onClick={() => applyAlign('left')}
            disabled={!selection}
            title="左对齐"
          >
            <AlignLeft size={14} />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-icon-only"
            onClick={() => applyAlign('center')}
            disabled={!selection}
            title="居中对齐"
          >
            <AlignCenter size={14} />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-icon-only"
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
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => exportToExcel(data)}>
            <Download size={14} /> 导出 Excel
          </button>
        </div>
      </div>

      <div className={`formula-bar ${isFormulaEditing ? 'formula-bar-active' : ''}`}>
        <span className="formula-bar-ref">{activeCell ? cellAddress(activeCell.row, activeCell.col) : ''}</span>
        <span className="formula-bar-fx">fx</span>
        <FormulaBarEditor
          inputRef={formulaBarRef}
          value={formulaBarValue}
          placeholder={activeCell ? '输入 = 后点击单元格可引用，如 =B2+C2' : '选择单元格以编辑公式'}
          disabled={!activeCell}
          onChange={(value) => {
            if (!activeCell) return
            updateCell(activeCell.row, activeCell.col, value)
          }}
          onFocus={() => {
            if (activeCell) setEditingCell(activeCell)
            setFormulaBarFocused(true)
            editHistoryStartedRef.current = false
          }}
          onBlur={() => {
            // 延迟清除，避免切换到单元格输入时 editingCell 被过早清空
            requestAnimationFrame(() => {
              if (document.activeElement?.closest('.data-table-wrapper')) return
              setFormulaBarFocused(false)
              setEditingCell(null)
              editHistoryStartedRef.current = false
            })
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
              e.preventDefault()
              onUndo()
              return
            }
            if (e.key === 'F4' && activeCell) {
              e.preventDefault()
              cycleReferenceAtCursor(e.currentTarget, activeCell.row, activeCell.col)
              return
            }
            if (e.key === 'Enter' && activeCell) {
              e.preventDefault()
              const nextRow = Math.min(activeCell.row + 1, data.length - 1)
              commitEdit({ row: nextRow, col: activeCell.col })
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              commitEdit()
            }
          }}
        />
      </div>

      <p className="table-tip">
        拖拽右下角填充公式；F4 切换引用类型（A1 / $A$1 / A$1 / $A1）；Ctrl+Z 撤回
      </p>

      <div className="table-scroll">
        <table ref={tableRef} className="data-table">
          <thead>
            <tr>
              <th className="sheet-corner" aria-hidden="true" />
              {Array.from({ length: colCount }, (_, colIdx) => (
                <th
                  key={`col-${colIdx}`}
                  className={`sheet-col-header${axisActiveCol === colIdx ? ' sheet-axis-active' : ''}`}
                >
                  {colToLetter(colIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <th
                  className={`sheet-row-header${axisActiveRow === rowIdx ? ' sheet-axis-active' : ''}`}
                >
                  {rowIdx + 1}
                </th>
                {row.map((cell, colIdx) => {
                  if (isHiddenByMerge(meta, rowIdx, colIdx)) return null

                  const merge = findMergeAt(meta, rowIdx, colIdx)
                  const isAnchor = merge?.row === rowIdx && merge?.col === colIdx
                  const align = getCellAlign(meta, rowIdx, colIdx)
                  const selected = isCellSelected(selection, rowIdx, colIdx)
                  const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx
                  const isPickTarget = isFormulaEditing && !isEditing
                  const hasFormula = isFormula(cell)
                  const isEditingThis =
                    (isEditing && !formulaBarFocused) ||
                    (formulaBarFocused &&
                      activeCell?.row === rowIdx &&
                      activeCell?.col === colIdx)
                  const displayValue = isEditingThis
                    ? cell
                    : getCellDisplayValue(data, rowIdx, colIdx)
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

                  return (
                    <td
                      key={colIdx}
                      rowSpan={isAnchor && merge ? merge.rowSpan : undefined}
                      colSpan={isAnchor && merge ? merge.colSpan : undefined}
                      style={refHighlightStyle}
                      className={[
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
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
                    >
                      <FormulaOverlayInput
                        inputRef={(el) => {
                          if (el) cellInputRefs.current[inputKey] = el
                          else delete cellInputRefs.current[inputKey]
                        }}
                        className={`cell-input ${rowIdx === 0 ? 'header-input' : ''} ${colIdx === 0 && rowIdx > 0 ? 'label-cell' : ''} ${colIdx > 0 && rowIdx > 0 ? 'value-cell' : ''}`}
                        wrapClassName="cell-input-wrap"
                        highlightClassName="cell-formula-highlight"
                        style={{ textAlign: align }}
                        highlightStyle={{ textAlign: align }}
                        value={isEditingThis ? cell : displayValue}
                        onChange={(value) => updateCell(rowIdx, colIdx, value)}
                        onKeyDown={(e) => handleEditorKeyDown(rowIdx, colIdx, e)}
                        onFocus={() => {
                          setEditingCell({ row: rowIdx, col: colIdx })
                          setFormulaBarFocused(false)
                          editHistoryStartedRef.current = false
                        }}
                        onBlur={() => {
                          if (formulaBarFocusedRef.current) return
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
    </div>
  )
}
