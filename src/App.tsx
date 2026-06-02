import { useCallback, useMemo, useRef, useState } from 'react'
import { Table2, Upload, BarChart2 } from 'lucide-react'
import DataTable from './components/DataTable'
import ExcelUpload from './components/ExcelUpload'
import ChartTypeSelector from './components/ChartTypeSelector'
import ChartSettings from './components/ChartSettings'
import ChartPreview from './components/ChartPreview'
import { useTableUndoShortcut, useUndoableTableState } from './hooks/useUndoableTableState'
import { DEFAULT_TABLE, createTableState, type ChartConfig } from './types'
import { parseTableData, validateTableData } from './utils/parseData'
import './App.css'

type InputTab = 'table' | 'upload'

const DEFAULT_CONFIG: ChartConfig = {
  type: 'bar',
  title: '销售数据分析',
  subtitle: '2024 年上半年',
  showLegend: true,
  legendItemGap: 20,
  showGrid: true,
  smooth: true,
  stacked: false,
  colorScheme: 'default',
  barStyle: 'rounded',
}

export default function App() {
  const { state: tableState, applyChange, undo } = useUndoableTableState(
    createTableState(DEFAULT_TABLE),
  )
  const resetTableEditRef = useRef<(() => void) | null>(null)
  const [inputTab, setInputTab] = useState<InputTab>('table')
  const [chartConfig, setChartConfig] = useState<ChartConfig>(DEFAULT_CONFIG)

  const resetTableEdit = useCallback(() => {
    resetTableEditRef.current?.()
  }, [])

  const performUndo = useCallback(() => {
    const done = undo()
    if (done) resetTableEdit()
    return done
  }, [undo, resetTableEdit])

  useTableUndoShortcut(performUndo, resetTableEdit, inputTab === 'table')

  const parsed = useMemo(() => parseTableData(tableState.data), [tableState.data])
  const validationError = useMemo(() => validateTableData(tableState.data), [tableState.data])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-icon">
            <BarChart2 size={24} />
          </div>
          <div>
            <h1>ChartCraft</h1>
            <p>数据可视化图表生成器</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="panel panel-data">
          <div className="panel-header">
            <h2>数据源</h2>
            <div className="tab-bar">
              <button
                type="button"
                className={`tab ${inputTab === 'table' ? 'active' : ''}`}
                onClick={() => setInputTab('table')}
              >
                <Table2 size={16} />
                手动填表
              </button>
              <button
                type="button"
                className={`tab ${inputTab === 'upload' ? 'active' : ''}`}
                onClick={() => setInputTab('upload')}
              >
                <Upload size={16} />
                上传 Excel
              </button>
            </div>
          </div>

          <div className="panel-body">
            {inputTab === 'table' ? (
              <DataTable
                state={tableState}
                onChange={applyChange}
                onUndo={performUndo}
                resetEditRef={resetTableEditRef}
              />
            ) : (
              <ExcelUpload
                onImport={(data) => {
                  applyChange(createTableState(data))
                  setInputTab('table')
                }}
              />
            )}
          </div>

          <div className="data-hint">
            <strong>数据格式：</strong>第一列为分类，其余列为数值；单元格支持 Excel 公式（如 =SUM(B2:B7)）。
          </div>
        </section>

        <section className="panel panel-chart">
          <div className="panel-header">
            <h2>图表配置</h2>
          </div>

          <div className="panel-body chart-panel-body">
            <ChartTypeSelector
              value={chartConfig.type}
              onChange={(type) => setChartConfig({ ...chartConfig, type })}
            />

            <ChartSettings config={chartConfig} onChange={setChartConfig} />

            <div className="preview-section">
              <h3>图表预览</h3>
              {validationError ? (
                <div className="preview-empty">
                  <p>{validationError}</p>
                </div>
              ) : parsed ? (
                <ChartPreview parsed={parsed} config={chartConfig} />
              ) : (
                <div className="preview-empty">
                  <p>请输入有效数据以生成图表</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <span>ChartCraft — 表格数据 · Excel 导入 · 多类型图表 · PNG 导出</span>
      </footer>
    </div>
  )
}
