import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import DocumentFormatPanel from './DocumentFormatPanel'
import type { FormatAdjustReport } from '../utils/documentFormatAdjust'

const report: FormatAdjustReport = {
  items: [
    {
      id: 'hint',
      kind: 'advisory',
      title: '文本格式已较规范',
      detail: '请点上方「公文版式」查看标题居中、正文首行缩进等视觉效果',
      autoApply: false,
    },
  ],
  changed: false,
  changeLineCount: 0,
  previewContent: '标题\n正文',
}

describe('DocumentFormatPanel without official-preview shortcut', () => {
  it('does not show 查看公文版式 when results are ready for export', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)

    act(() => {
      root.render(
        <DocumentFormatPanel
          report={report}
          onAnalyze={() => {}}
          onRequestApply={() => {}}
          onConfirmApply={() => {}}
          onCancelApply={() => {}}
          onDismiss={() => {}}
          onGoExport={vi.fn()}
        />,
      )
    })

    expect(host.textContent).toContain('下一步：导出 Word')
    expect(host.textContent).not.toContain('查看公文版式')
    expect(host.textContent).not.toContain('在左侧查看')

    act(() => root.unmount())
    host.remove()
  })
})
