import { useCallback, useState } from 'react'
import AppHeader, { type WorkspaceId } from './components/AppHeader'
import ChartWorkspace from './components/ChartWorkspace'
import DocumentWorkspace from './components/DocumentWorkspace'
import './App.css'

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

      {workspace === 'chart' ? (
        <ChartWorkspace onSavedLabelChange={handleSavedLabelChange} />
      ) : (
        <DocumentWorkspace onSavedLabelChange={handleSavedLabelChange} />
      )}

      <footer className="app-footer">
        <span>
          ChartCraft — {workspace === 'chart' ? '表格数据 · Excel 导入 · 多类型图表 · PNG 导出' : '报告文档 · 本地自动保存'}
        </span>
      </footer>
    </div>
  )
}
