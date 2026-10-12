import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../utils/documentA4Layout', async () => {
  const actual = await vi.importActual<typeof import('../utils/documentA4Layout')>(
    '../utils/documentA4Layout',
  )
  return {
    ...actual,
    buildOfficialLayoutPages: vi.fn(() => ({
      pagesHtml: [
        '<p class="doc-layout-p doc-layout-title">标题</p>',
        '<p class="doc-layout-p doc-layout-body">第二页正文</p>',
      ],
      pageCount: 2,
    })),
  }
})

describe('DocumentOfficialLayoutPreview', () => {
  it('renders Word-like A4 sheets and page status', async () => {
    const { default: DocumentOfficialLayoutPreview } = await import('./DocumentOfficialLayoutPreview')
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)

    await act(async () => {
      root.render(<DocumentOfficialLayoutPreview content={'标题\n正文'} />)
    })

    expect(host.querySelectorAll('.document-a4-sheet')).toHaveLength(2)
    expect(host.textContent).toContain('第 1 页，共 2 页 · A4')
    expect(host.querySelector('.document-a4-status')).toBeTruthy()

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
