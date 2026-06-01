import { useCallback, useRef, useState } from 'react'
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
import type { CellAlign, TableState } from '../types'
import { createTableState } from '../types'
import { exportToExcel } from '../utils/excelParser'
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
  onChange: (state: TableState) => void
  onBeforeChange: () => void
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

export default function DataTable({ state, onChange, onBeforeChange }: DataTableProps) {
  const { data, meta } = state
  const tableRef = useRef<HTMLTableElement>(null)
  const [selection, setSelection] = useState<CellSelection | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const editSnapshotPushed = useRef(false)

  const commitChange = useCallback(
    (next: TableState) => {
      onBeforeChange()
      onChange(next)
    },
    [onBeforeChange, onChange],
  )

  const updateCell = useCallback(
    (row: number, col: number, value: string) => {
      const next = data.map((r, ri) =>
        r.map((c, ci) => (ri === row && ci === col ? value : c)),
      )
      onChange({ data: next, meta })
    },
    [data, meta, onChange],
  )

  const handleCellMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    if (isHiddenByMerge(meta, row, col)) return
    if (e.shiftKey && selection) {
      setSelection({ start: selection.start, end: { row, col } })
    } else {
      setSelection({ start: { row, col }, end: { row, col } })
      setIsDragging(true)
    }
  }

  const handleCellMouseEnter = (row: number, col: number) => {
    if (!isDragging || !selection) return
    if (isHiddenByMerge(meta, row, col)) return
    setSelection({ start: selection.start, end: { row, col } })
  }

  const handleMouseUp = () => setIsDragging(false)

  const applyAlign = (align: CellAlign) => {
    if (!selection) return
    commitChange(setSelectionAlign(state, selection, align))
  }

  const handleMerge = () => {
    if (!selection || selectionSize(selection) < 2) return
    commitChange(mergeSelection(state, selection))
  }

  const handleUnmerge = () => {
    if (!selection) return
    const { row, col } = selection.start
    commitChange(unmergeAt(state, row, col))
  }

  const canMerge = selection !== null && selectionSize(selection) >= 2
  const canUnmerge = selection !== null && findMergeAt(meta, selection.start.row, selection.start.col) !== null

  return (
    <div className="data-table-wrapper" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="table-toolbar">
        <div className="toolbar-group">
          <button type="button" className="btn btn-sm" onClick={() => commitChange(addTableRow(state))} title="添加行">
            <Plus size={14} /> 行
          </button>
          <button type="button" className="btn btn-sm" onClick={() => commitChange(removeTableRow(state))} title="删除行">
            <Minus size={14} /> 行
          </button>
          <button type="button" className="btn btn-sm" onClick={() => commitChange(addTableCol(state))} title="添加列">
            <Plus size={14} /> 列
          </button>
          <button type="button" className="btn btn-sm" onClick={() => commitChange(removeTableCol(state))} title="删除列">
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
            onClick={() => commitChange(transposeTableState(state))}
            title="将行与列互换"
          >
            <ArrowRightLeft size={14} /> 切换行列
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => commitChange(createTableState(SAMPLE_DATA.map((r) => [...r])))}
          >
            <RotateCcw size={14} /> 示例数据
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => exportToExcel(data)}>
            <Download size={14} /> 导出 Excel
          </button>
        </div>
      </div>

      <p className="table-tip">拖拽或 Shift+点击选择单元格；Ctrl+Z 撤回操作</p>

      <div className="table-scroll">
        <table ref={tableRef} className="data-table">
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, colIdx) => {
                  if (isHiddenByMerge(meta, rowIdx, colIdx)) return null

                  const merge = findMergeAt(meta, rowIdx, colIdx)
                  const isAnchor = merge?.row === rowIdx && merge?.col === colIdx
                  const align = getCellAlign(meta, rowIdx, colIdx)
                  const selected = isCellSelected(selection, rowIdx, colIdx)
                  const Tag = rowIdx === 0 ? 'th' : 'td'

                  return (
                    <Tag
                      key={colIdx}
                      rowSpan={isAnchor && merge ? merge.rowSpan : undefined}
                      colSpan={isAnchor && merge ? merge.colSpan : undefined}
                      className={selected ? 'cell-selected' : undefined}
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, colIdx, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
                    >
                      <input
                        className={`cell-input ${rowIdx === 0 ? 'header-input' : ''} ${colIdx === 0 && rowIdx > 0 ? 'label-cell' : ''} ${colIdx > 0 && rowIdx > 0 ? 'value-cell' : ''}`}
                        style={{ textAlign: align }}
                        value={cell}
                        onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                        onFocus={() => {
                          if (!editSnapshotPushed.current) {
                            onBeforeChange()
                            editSnapshotPushed.current = true
                          }
                        }}
                        onBlur={() => {
                          editSnapshotPushed.current = false
                        }}
                        placeholder={rowIdx === 0 ? `列 ${colIdx + 1}` : colIdx === 0 ? '分类' : '数值'}
                      />
                    </Tag>
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
