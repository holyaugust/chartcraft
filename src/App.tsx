import { lazy, Suspense, useCallback, useState } from 'react'
import AppHeader, { type WorkspaceId } from './components/AppHeader'
import ChartWorkspace from './components/ChartWorkspace'
import './App.css'

const DocumentWorkspace = lazy(() => import('./components/DocumentWorkspace'))
const DiagramWorkspace = lazy(() => import('./components/DiagramWorkspace'))

function WorkspaceFallback() {
  return (
    <div className="workspace-loading" role="status" aria-live="polite">
      加载工作区…
    </div>
  )
}

function workspaceFooter(workspace: WorkspaceId): string {
  switch (workspace) {
    case 'chart':
      return '表格数据 · Excel 导入 · 多类型图表 · PNG 导出'
    case 'document':
      return '报告文档 · 本地自动保存'
    case 'flowchart':
      return 'AI 流程图 · Mermaid · SVG/PNG 导出'
    case 'mindmap':
      return 'AI 思维导图 · Mermaid · SVG/PNG 导出'
  }
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceId>('chart')
  const [savedLabel, setSavedLabel] = useState('')

  const handleSavedLabelChange = useCallback((label: string) => {
    setSavedLabel(label)
  }, [])

  return (
    <div className="app">
      <AppHeader
        workspace={workspace}
        onWorkspaceChange={setWorkspace}
        savedLabel={savedLabel}
      />

      <Suspense fallback={<WorkspaceFallback />}>
        {workspace === 'chart' ? (
          <ChartWorkspace onSavedLabelChange={handleSavedLabelChange} />
        ) : workspace === 'document' ? (
          <DocumentWorkspace onSavedLabelChange={handleSavedLabelChange} />
        ) : (
          <DiagramWorkspace
            key={workspace}
            kind={workspace}
            onSavedLabelChange={handleSavedLabelChange}
          />
        )}
      </Suspense>

      <footer className="app-footer">
        <span>ChartCraft — {workspaceFooter(workspace)}</span>
      </footer>
    </div>
  )
}
