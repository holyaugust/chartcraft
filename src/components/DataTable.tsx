import { useCallback, useRef } from 'react'
import { Plus, Minus, Download, RotateCcw, ArrowRightLeft } from 'lucide-react'
import type { TableData } from '../types'
import { exportToExcel } from '../utils/excelParser'
import { transposeTable } from '../utils/tableUtils'

interface DataTableProps {
  data: TableData
  onChange: (data: TableData) => void
}

export default function DataTable({ data, onChange }: DataTableProps) {
  const tableRef = useRef<HTMLTableElement>(null)

  const updateCell = useCallback(
    (row: number, col: number, value: string) => {
      const next = data.map((r, ri) =>
        r.map((c, ci) => (ri === row && ci === col ? value : c)),
      )
      onChange(next)
    },
    [data, onChange],
  )

  const addRow = () => {
    const cols = data[0]?.length ?? 2
    onChange([...data, Array(cols).fill('')])
  }

  const removeRow = () => {
    if (data.length <= 2) return
    onChange(data.slice(0, -1))
  }

  const addCol = () => {
    onChange(data.map((row, i) => [...row, i === 0 ? `列${row.length + 1}` : '']))
  }

  const removeCol = () => {
    if ((data[0]?.length ?? 0) <= 2) return
    onChange(data.map((row) => row.slice(0, -1)))
  }

  const resetSample = () => {
    onChange([
      ['月份', '销售额', '利润', '成本'],
      ['1月', '8200', '2100', '6100'],
      ['2月', '9320', '2540', '6780'],
      ['3月', '9010', '2380', '6630'],
      ['4月', '9340', '2890', '6450'],
      ['5月', '12900', '3900', '9000'],
      ['6月', '13300', '4200', '9100'],
    ])
  }

  const switchRowsCols = () => {
    onChange(transposeTable(data))
  }

  return (
    <div className="data-table-wrapper">
      <div className="table-toolbar">
        <div className="toolbar-group">
          <button type="button" className="btn btn-sm" onClick={addRow} title="添加行">
            <Plus size={14} /> 行
          </button>
          <button type="button" className="btn btn-sm" onClick={removeRow} title="删除行">
            <Minus size={14} /> 行
          </button>
          <button type="button" className="btn btn-sm" onClick={addCol} title="添加列">
            <Plus size={14} /> 列
          </button>
          <button type="button" className="btn btn-sm" onClick={removeCol} title="删除列">
            <Minus size={14} /> 列
          </button>
        </div>
        <div className="toolbar-group">
          <button type="button" className="btn btn-sm btn-ghost" onClick={switchRowsCols} title="将行与列互换">
            <ArrowRightLeft size={14} /> 切换行列
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={resetSample}>
            <RotateCcw size={14} /> 示例数据
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => exportToExcel(data)}
          >
            <Download size={14} /> 导出 Excel
          </button>
        </div>
      </div>

      <div className="table-scroll">
        <table ref={tableRef} className="data-table">
          <thead>
            <tr>
              {data[0]?.map((cell, col) => (
                <th key={col}>
                  <input
                    className="cell-input header-input"
                    value={cell}
                    onChange={(e) => updateCell(0, col, e.target.value)}
                    placeholder={`列 ${col + 1}`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(1).map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, col) => (
                  <td key={col}>
                    <input
                      className={`cell-input ${col === 0 ? 'label-cell' : 'value-cell'}`}
                      value={cell}
                      onChange={(e) => updateCell(rowIdx + 1, col, e.target.value)}
                      placeholder={col === 0 ? '分类' : '数值'}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
