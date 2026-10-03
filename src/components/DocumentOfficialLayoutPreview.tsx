import { useMemo } from 'react'
import { buildOfficialLayoutHtml } from '../utils/documentOfficialLayout'

interface DocumentOfficialLayoutPreviewProps {
  content: string
  banner?: string | null
}

export default function DocumentOfficialLayoutPreview({
  content,
  banner = null,
}: DocumentOfficialLayoutPreviewProps) {
  const html = useMemo(() => buildOfficialLayoutHtml(content), [content])

  return (
    <div className="document-official-layout">
      {banner ? <div className="document-official-layout-banner">{banner}</div> : null}
      <div className="document-official-layout-page" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
