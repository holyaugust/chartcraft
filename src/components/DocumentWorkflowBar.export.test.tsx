import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import DocumentWorkflowBar from './DocumentWorkflowBar'

describe('DocumentWorkflowBar export menu', () => {
  it('hosts the export dropdown on the 导出 Word step', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)
    const onExportAction = vi.fn()
    const onExportMenuToggle = vi.fn()

    act(() => {
      root.render(
        <DocumentWorkflowBar
          activeStep="format"
          completedThrough="proofread"
          hasContent
          exportMenuOpen
          canKeepOriginalLayout
          onExportMenuToggle={onExportMenuToggle}
          onExportAction={onExportAction}
          onStepClick={() => {}}
        />,
      )
    })

    expect(host.textContent).not.toContain('导出文件')
    expect(host.textContent).toContain('导出 Word')
    expect(host.textContent).toContain('保留原版式导出')
    expect(host.textContent).toContain('导出 TXT')
    expect(host.querySelector('.document-export-menu')).toBeTruthy()

    const keepOriginal = [...host.querySelectorAll('[role="menuitem"]')].find((item) =>
      item.textContent?.includes('保留原版式导出'),
    )
    act(() => {
      keepOriginal?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onExportAction).toHaveBeenCalledWith('original-docx')

    act(() => root.unmount())
    host.remove()
  })

  it('keeps 导出 Word clickable even when it is already the active step', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)
    const onExportMenuToggle = vi.fn()

    act(() => {
      root.render(
        <DocumentWorkflowBar
          activeStep="export"
          completedThrough="export"
          hasContent
          exportMenuOpen={false}
          onExportMenuToggle={onExportMenuToggle}
          onExportAction={() => {}}
          onStepClick={() => {}}
        />,
      )
    })

    const exportButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('导出 Word'),
    )
    expect(exportButton).toBeTruthy()

    act(() => {
      exportButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onExportMenuToggle).toHaveBeenCalled()

    act(() => root.unmount())
    host.remove()
  })
})
