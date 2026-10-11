import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import DocumentProofreadBusyOverlay from './DocumentProofreadBusyOverlay'

describe('DocumentProofreadBusyOverlay', () => {
  it('renders a blocking overlay with progress copy', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)

    act(() => {
      root.render(
        <DocumentProofreadBusyOverlay open message="正在智能校对（计划总结 · AI）…" />,
      )
    })

    const overlay = host.querySelector('.document-proofread-busy-overlay')
    expect(overlay).toBeTruthy()
    expect(overlay?.getAttribute('aria-busy')).toBe('true')
    expect(host.textContent).toContain('正在智能校对（计划总结 · AI）…')
    expect(host.textContent).toContain('请稍候')

    act(() => root.unmount())
    host.remove()
  })

  it('renders nothing when closed', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root: Root = createRoot(host)

    act(() => {
      root.render(<DocumentProofreadBusyOverlay open={false} message="正在智能校对…" />)
    })

    expect(host.querySelector('.document-proofread-busy-overlay')).toBeNull()

    act(() => root.unmount())
    host.remove()
  })
})
