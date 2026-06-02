import { useRef, useState } from 'react'
import { Upload, FileSpreadsheet, X } from 'lucide-react'
import { parseExcelFile } from '../utils/excelParser'
import type { TableState } from '../types'

interface ExcelUploadProps {
  onImport: (state: TableState) => void
}

export default function ExcelUpload({ onImport }: ExcelUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('请上传 .xlsx、.xls 或 .csv 格式的文件')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const state = await parseExcelFile(file)
      setFileName(file.name)
      onImport(state)
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件解析失败')
      setFileName(null)
    } finally {
      setLoading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const clearFile = () => {
    setFileName(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="excel-upload">
      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''} ${loading ? 'loading' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />

        <div className="drop-icon">
          {loading ? (
            <div className="spinner" />
          ) : (
            <Upload size={32} strokeWidth={1.5} />
          )}
        </div>

        <p className="drop-title">
          {loading ? '正在解析文件...' : '拖拽 Excel 文件到此处，或点击上传'}
        </p>
        <p className="drop-hint">支持 .xlsx、.xls、.csv 格式</p>
      </div>

      {fileName && (
        <div className="file-info">
          <FileSpreadsheet size={16} />
          <span>{fileName}</span>
          <button type="button" className="btn-icon" onClick={clearFile} aria-label="清除">
            <X size={14} />
          </button>
        </div>
      )}

      {error && <p className="error-msg">{error}</p>}
    </div>
  )
}
