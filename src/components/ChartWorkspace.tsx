import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Table2, Upload } from 'lucide-react'
import DataTable from './DataTable'
import ExcelUpload from './ExcelUpload'
import WorkbookTabs from './WorkbookTabs'
import ChartTemplateLibrary from './ChartTemplateLibrary'
import ChartTypeSelector from './ChartTypeSelector'
import ChartSettings from './ChartSettings'
import ChartPreview from './ChartPreview'
import { useWorkbookState } from '../hooks/useWorkbookState'
import { useTableHistoryShortcuts } from '../hooks/useUndoableTableState'
import { type ChartConfig, createTableState } from '../types'
import type { ChartTemplate } from '../data/chartTemplates'
import { parseTableData, validateTableData } from '../utils/parseData'
import {
  createDefaultProjectDraft,
  loadProjectDraft,
  saveProjectDraft,
  type ProjectDraft,
} from '../utils/projectStorage'

type InputTab = 'table' | 'upload'

interface ChartWorkspaceProps {
  onSavedLabelChange: (label: string) => void
  onInsertToPresentation?: () => void
}

function getInitialDraft(): ProjectDraft {
  return loadProjectDraft() ?? createDefaultProjectDraft()
}

export default function ChartWorkspace({ onSavedLabelChange, onInsertToPresentation }: ChartWorkspaceProps) {
  const initialDraftRef = useRef(getInitialDraft())
  const {
    workbook,
    activeState: tableState,
    applyChange,
    setActiveSheet,
    replaceWorkbook,
    addSheet,
    deleteSheet,
    renameSheet,
    undo,
    redo,
  } = useWorkbookState(initialDraftRef.current.workbook)
  const resetTableEditRef = useRef<(() => void) | null>(null)
  const [inputTab, setInputTab] = useState<InputTab>('table')
  const [chartConfig, setChartConfig] = useState<ChartConfig>(initialDraftRef.current.chartConfig)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
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

  const handleSelectSheet = useCallback(
    (id: string) => {
      setActiveSheet(id)
      resetTableEdit()
    },
    [setActiveSheet, resetTableEdit],
  )

  const handleApplyTemplate = useCallback(
    (template: ChartTemplate, withSampleData: boolean) => {
      setChartConfig({ ...template.config })
      setActiveTemplateId(template.id)
      if (withSampleData) {
        applyChange(createTableState(template.sampleData.map((row) => [...row])))
        resetTableEdit()
        setInputTab('table')
      }
    },
    [applyChange, resetTableEdit],
  )

  const handleChartConfigChange = useCallback((next: ChartConfig) => {
    setChartConfig(next)
    setActiveTemplateId(null)
  }, [])

  const handleChartTypeChange = useCallback(
    (type: ChartConfig['type']) => {
      handleChartConfigChange({ ...chartConfig, type })
    },
    [chartConfig, handleChartConfigChange],
  )

  useTableHistoryShortcuts(performUndo, performRedo, resetTableEdit, inputTab === 'table')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveProjectDraft(workbook, chartConfig)
      setLastSavedAt(Date.now())
    }, 400)
    return () => window.clearTimeout(timer)
  }, [workbook, chartConfig])

  const parsed = useMemo(() => parseTableData(tableState.data), [tableState.data])
  const validationError = useMemo(() => validateTableData(tableState.data), [tableState.data])

  const savedLabel = useMemo(() => {
    const date = new Date(lastSavedAt)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }, [lastSavedAt])

  useEffect(() => {
    onSavedLabelChange(savedLabel)
  }, [savedLabel, onSavedLabelChange])

  return (
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
              key={workbook.activeSheetId}
              state={tableState}
              onChange={applyChange}
              onUndo={performUndo}
              onRedo={performRedo}
              resetEditRef={resetTableEditRef}
              sheetTabs={
                <WorkbookTabs
                  sheets={workbook.sheets.map((sheet) => ({ id: sheet.id, name: sheet.name }))}
                  activeId={workbook.activeSheetId}
                  onSelect={handleSelectSheet}
                  onAdd={() => {
                    addSheet()
                    resetTableEdit()
                  }}
                  onDelete={(id) => {
                    deleteSheet(id)
                    resetTableEdit()
                  }}
                  onRename={renameSheet}
                />
              }
            />
          ) : (
            <ExcelUpload
              onImportSheets={(sheets) => {
                replaceWorkbook(sheets)
                resetTableEdit()
                setInputTab('table')
              }}
            />
          )}
        </div>

        <div className="data-hint">
          <strong>数据格式：</strong>第一列为分类，其余列为数值；单元格支持 Excel 公式（如 =SUM(B2:B7)）。
          支持 Ctrl+C/V/X 复制粘贴；底部标签可切换工作表，点击 + 添加，双击重命名，右键删除。
        </div>
      </section>

      <section className="panel panel-chart">
        <div className="panel-header chart-panel-header-with-action">
          <h2>图表配置</h2>
          {onInsertToPresentation ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={!parsed}
              onClick={onInsertToPresentation}
              title="将当前图表插入汇报 PPT"
            >
              <BarChart3 size={14} />
              插入汇报 PPT
            </button>
          ) : null}
        </div>

        <div className="panel-body chart-panel-body">
          <ChartTemplateLibrary activeTemplateId={activeTemplateId} onApply={handleApplyTemplate} />

          <ChartTypeSelector value={chartConfig.type} onChange={handleChartTypeChange} />

          <ChartSettings config={chartConfig} onChange={handleChartConfigChange} />

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
  )
}
