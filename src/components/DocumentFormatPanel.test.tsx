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

const changedReport: FormatAdjustReport = {
  ...report,
  changed: true,
  changeLineCount: 3,
  items: [
    {
      id: 'blank',
      kind: 'blank-line',
      title: '合并多余空行',
      detail: '将连续空行压成单行间隔',
      autoApply: true,
    },
  ],
  previewContent: '特发服务2027年度资本运作计划报告\n一、概况\n正文',
}

describe('DocumentFormatPanel without official-preview shortcut', () => {
  it('does not show sidebar typesetting preview when there are applyable changes', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)

    act(() => {
      root.render(
        <DocumentFormatPanel
          report={changedReport}
          onAnalyze={() => {}}
          onRequestApply={() => {}}
          onConfirmApply={() => {}}
          onCancelApply={() => {}}
          onDismiss={() => {}}
        />,
      )
    })

    expect(host.textContent).toContain('应用智能排版')
    expect(host.textContent).not.toContain('排版后预览')
    expect(host.querySelector('.document-format-preview')).toBeNull()

    act(() => root.unmount())
    host.remove()
  })

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

  it('scrolls to a format issue when its row is clicked and can undo an applied pass', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)
    const onLocate = vi.fn()
    const onUndo = vi.fn()

    act(() => {
      root.render(
        <DocumentFormatPanel
          report={changedReport}
          canUndo
          onLocate={onLocate}
          onUndo={onUndo}
          onAnalyze={() => {}}
          onRequestApply={() => {}}
          onConfirmApply={() => {}}
          onCancelApply={() => {}}
          onDismiss={() => {}}
        />,
      )
    })

    const row = host.querySelector('.document-format-locate') as HTMLButtonElement
    act(() => {
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onLocate).toHaveBeenCalledWith(expect.objectContaining({ id: 'blank' }))

    const undo = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('撤销本次排版'),
    )
    act(() => {
      undo?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onUndo).toHaveBeenCalled()

    act(() => root.unmount())
    host.remove()
  })
})
