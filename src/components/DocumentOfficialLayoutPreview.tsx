import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  buildOfficialLayoutPages,
  formatA4PageStatus,
} from '../utils/documentA4Layout'

interface DocumentOfficialLayoutPreviewProps {
  content: string
  banner?: string | null
}

export default function DocumentOfficialLayoutPreview({
  content,
  banner = null,
}: DocumentOfficialLayoutPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagesHtml, setPagesHtml] = useState<string[]>([''])
  const [pageCount, setPageCount] = useState(1)

  useLayoutEffect(() => {
    const next = buildOfficialLayoutPages(content)
    setPagesHtml(next.pagesHtml)
    setPageCount(next.pageCount)
    setCurrentPage(1)
  }, [content])

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return

    const updateCurrent = () => {
      const sheets = [...scroller.querySelectorAll<HTMLElement>('.document-a4-sheet')]
      if (sheets.length === 0) return
      const mid = scroller.scrollTop + scroller.clientHeight / 3
      let best = 0
      let bestDist = Number.POSITIVE_INFINITY
      sheets.forEach((sheet, index) => {
        const top = sheet.offsetTop
        const center = top + sheet.offsetHeight / 2
        const dist = Math.abs(center - mid)
        if (dist < bestDist) {
          bestDist = dist
          best = index
        }
      })
      setCurrentPage(best + 1)
    }

    updateCurrent()
    scroller.addEventListener('scroll', updateCurrent, { passive: true })
    return () => scroller.removeEventListener('scroll', updateCurrent)
  }, [pagesHtml])

  return (
    <div className="document-official-layout">
      {banner ? <div className="document-official-layout-banner">{banner}</div> : null}
      <div className="document-a4-scroll" ref={scrollRef}>
        <div className="document-a4-stack">
          {pagesHtml.map((html, index) => (
            <div
              key={`a4-page-${index}`}
              className="document-official-layout-page document-a4-sheet"
              data-page={index + 1}
              aria-label={`第 ${index + 1} 页`}
            >
              <div
                className="document-a4-page-content"
                dangerouslySetInnerHTML={{ __html: html }}
              />
              <span className="document-a4-page-badge" aria-hidden>
                {index + 1}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="document-a4-status" role="status" aria-live="polite">
        {formatA4PageStatus(currentPage, pageCount)}
      </div>
    </div>
  )
}
