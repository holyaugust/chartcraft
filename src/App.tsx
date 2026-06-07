import { lazy, Suspense, useCallback, useState } from 'react'
import AppHeader, { type WorkspaceId } from './components/AppHeader'
import ChartWorkspace from './components/ChartWorkspace'
import './App.css'

const DocumentWorkspace = lazy(() => import('./components/DocumentWorkspace'))
const PresentationWorkspace = lazy(() => import('./components/PresentationWorkspace'))

function WorkspaceFallback() {
  return (
    <div className="workspace-loading" role="status" aria-live="polite">
      加载工作区…
    </div>
  )
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceId>('chart')
  const [savedLabel, setSavedLabel] = useState('')
  const [presentationSeed, setPresentationSeed] = useState<string | null>(null)
  const [presentationChartSeed, setPresentationChartSeed] = useState(false)

  const handleSavedLabelChange = useCallback((label: string) => {
    setSavedLabel(label)
  }, [])

  const handleOpenPresentation = useCallback((documentText: string) => {
    setPresentationSeed(documentText)
    setWorkspace('presentation')
  }, [])

  const handleInsertChartToPresentation = useCallback(() => {
    setPresentationChartSeed(true)
    setWorkspace('presentation')
  }, [])

  const footerText =
    workspace === 'chart'
      ? '表格数据 · Excel 导入 · 多类型图表 · PNG 导出'
      : workspace === 'document'
        ? '报告文档 · 本地自动保存'
        : '汇报 PPT · 预览 · 写回 · 图表嵌入'

  return (
    <div className="app">
      <AppHeader
        workspace={workspace}
        onWorkspaceChange={setWorkspace}
        savedLabel={savedLabel}
      />

      <Suspense fallback={<WorkspaceFallback />}>
        {workspace === 'chart' ? (
          <ChartWorkspace
            onSavedLabelChange={handleSavedLabelChange}
            onInsertToPresentation={handleInsertChartToPresentation}
          />
        ) : workspace === 'document' ? (
          <DocumentWorkspace
            onSavedLabelChange={handleSavedLabelChange}
            onOpenPresentation={handleOpenPresentation}
          />
        ) : (
          <PresentationWorkspace
            onSavedLabelChange={handleSavedLabelChange}
            seedDocument={presentationSeed}
            onSeedConsumed={() => setPresentationSeed(null)}
            chartSeed={presentationChartSeed}
            onChartSeedConsumed={() => setPresentationChartSeed(false)}
          />
        )}
      </Suspense>

      <footer className="app-footer">
        <span>ChartCraft — {footerText}</span>
      </footer>
    </div>
  )
}
