import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import DocumentFormatPanel from './DocumentFormatPanel'
import type { LayoutGenre } from '../data/documentLayoutSpecs'
import '../App.css'

const noop = () => {}

function renderPanel(props: {
  suggestedGenre: LayoutGenre
  confirmedGenre: LayoutGenre | null
  onConfirmGenre: (genre: string) => void
}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root: Root = createRoot(host)
  act(() => {
    root.render(
      <DocumentFormatPanel
        report={null}
        onAnalyze={noop}
        onRequestApply={noop}
        onConfirmApply={noop}
        onCancelApply={noop}
        onDismiss={noop}
        {...props}
      />,
    )
  })
  return { host, root }
}

describe('DocumentFormatPanel genre confirm', () => {
  it('confirms a genre without asking to apply structure edits', () => {
    const confirmed: string[] = []
    const { host, root } = renderPanel({
      suggestedGenre: 'contract',
      confirmedGenre: null,
      onConfirmGenre: (genre: string) => { confirmed.push(genre) },
    })
    const suggested = host.querySelector('[data-suggested="true"]')
    expect(suggested?.textContent).toBe('合同')
    act(() => { (host.querySelector('button[data-genre="feasibility"]') as HTMLButtonElement).click() })
    expect(confirmed).toEqual(['feasibility'])
    act(() => { root.unmount() })
  })
})
