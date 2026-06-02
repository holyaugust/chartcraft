import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Table2, Upload, BarChart2 } from 'lucide-react'
import DataTable from './components/DataTable'
import ExcelUpload from './components/ExcelUpload'
import ChartTypeSelector from './components/ChartTypeSelector'
import ChartSettings from './components/ChartSettings'
import ChartPreview from './components/ChartPreview'
import { useTableHistoryShortcuts, useUndoableTableState } from './hooks/useUndoableTableState'
import { type ChartConfig } from './types'
import { parseTableData, validateTableData } from './utils/parseData'
import {
  createDefaultProjectDraft,
  loadProjectDraft,
  saveProjectDraft,
  type ProjectDraft,
} from './utils/projectStorage'
import './App.css'

type InputTab = 'table' | 'upload'

function getInitialDraft(): ProjectDraft {
  return loadProjectDraft() ?? createDefaultProjectDraft()
}

export default function App() {
  const initialDraftRef = useRef(getInitialDraft())
  const { state: tableState, applyChange, undo, redo } = useUndoableTableState(
    initialDraftRef.current.tableState,
  )
  const resetTableEditRef = useRef<(() => void) | null>(null)
  const [inputTab, setInputTab] = useState<InputTab>('table')
  const [chartConfig, setChartConfig] = useState<ChartConfig>(initialDraftRef.current.chartConfig)
  const [lastSavedAt, setLastSavedAt] = useState<number>(initialDraftRef.current.savedAt)

  const resetTableEdit = useCallback(() => {
    resetTableEditRef.current?.()
  }, [])

  const performUndo = useCallback(() => {
    const done = undo()
    if (done) resetTableEdit()
    return done
  }, [undo, resetTableEdit])

  const performRedo = useCallback(() => {
    const done = redo()
    if (done) resetTableEdit()
    return done
  }, [redo, resetTableEdit])

  useTableHistoryShortcuts(performUndo, performRedo, resetTableEdit, inputTab === 'table')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveProjectDraft(tableState, chartConfig)
      setLastSavedAt(Date.now())
    }, 400)
    return () => window.clearTimeout(timer)
  }, [tableState, chartConfig])

  const parsed = useMemo(() => parseTableData(tableState.data), [tableState.data])
  const validationError = useMemo(() => validateTableData(tableState.data), [tableState.data])

  const savedLabel = useMemo(() => {
    const date = new Date(lastSavedAt)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }, [lastSavedAt])

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
        <span className="autosave-hint" title="表格与图表配置会自动保存到浏览器">
          已自动保存 {savedLabel}
        </span>
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
                onRedo={performRedo}
                resetEditRef={resetTableEditRef}
              />
            ) : (
              <ExcelUpload
                onImport={(nextState) => {
                  applyChange(nextState)
                  setInputTab('table')
                }}
              />
            )}
          </div>

          <div className="data-hint">
            <strong>数据格式：</strong>第一列为分类，其余列为数值；单元格支持 Excel 公式（如 =SUM(B2:B7)）。
            支持 Ctrl+C/V/X 复制粘贴、方向键与 Tab 导航。
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
