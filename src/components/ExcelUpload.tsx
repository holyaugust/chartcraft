import { useRef, useState } from 'react'
import { Upload, FileSpreadsheet, X } from 'lucide-react'
import { parseExcelFile, parseExcelSheets, previewExcelFile, type ExcelSheetInfo } from '../utils/excelParser'
import type { TableState } from '../types'

export interface ImportedSheet {
  name: string
  state: TableState
}

interface ExcelUploadProps {
  onImportSheets: (sheets: ImportedSheet[]) => void
}

export default function ExcelUpload({ onImportSheets }: ExcelUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<ExcelSheetInfo[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')

  const resetSheetPicker = () => {
    setPendingFile(null)
    setSheets([])
    setSelectedSheet('')
  }

  const finishImport = (file: File, imported: ImportedSheet[], mode: 'all' | 'one') => {
    onImportSheets(imported)
    if (mode === 'all') {
      setFileName(`${file.name} · ${imported.length} 个工作表`)
      setInfo(`已导入 ${imported.length} 个工作表，可在上方标签切换`)
    } else {
      setFileName(`${file.name} · ${imported[0]?.name ?? ''}`)
      setInfo(null)
    }
    resetSheetPicker()
  }

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('请上传 .xlsx、.xls 或 .csv 格式的文件')
      return
    }

    setLoading(true)
    setError(null)
    setInfo(null)
    resetSheetPicker()

    try {
      const preview = await previewExcelFile(file)

      if (preview.sheetNames.length <= 1) {
        const imported = await parseExcelSheets(file)
        finishImport(file, imported, 'all')
        return
      }

      setPendingFile(file)
      setSheets(preview.sheets)
      setSelectedSheet(preview.sheetNames[0])
      setFileName(file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件解析失败')
      setFileName(null)
      resetSheetPicker()
    } finally {
      setLoading(false)
    }
  }

  const confirmImportAll = async () => {
    if (!pendingFile) return

    setLoading(true)
    setError(null)

    try {
      const imported = await parseExcelSheets(pendingFile)
      finishImport(pendingFile, imported, 'all')
    } catch (err) {
      setError(err instanceof Error ? err.message : '工作表导入失败')
    } finally {
      setLoading(false)
    }
  }

  const confirmImportSelected = async () => {
    if (!pendingFile || !selectedSheet) return

    setLoading(true)
    setError(null)

    try {
      const state = await parseExcelFile(pendingFile, selectedSheet)
      finishImport(pendingFile, [{ name: selectedSheet, state }], 'one')
    } catch (err) {
      setError(err instanceof Error ? err.message : '工作表导入失败')
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
    setInfo(null)
    resetSheetPicker()
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
        <p className="drop-hint">支持 .xlsx、.xls、.csv；多工作表可一次全部导入</p>
      </div>

      {pendingFile && sheets.length > 1 && (
        <div className="sheet-picker">
          <p className="sheet-picker-title">
            检测到 {sheets.length} 个工作表，可全部导入为标签页，或仅导入其中一张：
          </p>
          <ul className="sheet-list" role="listbox" aria-label="工作表列表">
            {sheets.map((sheet) => (
              <li key={sheet.name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedSheet === sheet.name}
                  className={`sheet-option ${selectedSheet === sheet.name ? 'selected' : ''}`}
                  onClick={() => setSelectedSheet(sheet.name)}
                >
                  <span className="sheet-option-name">{sheet.name}</span>
                  <span className="sheet-option-meta">
                    {sheet.rowCount} 行 × {sheet.colCount} 列
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="sheet-picker-actions">
            <button
              type="button"
              className="btn-primary sheet-import-btn"
              disabled={loading}
              onClick={confirmImportAll}
            >
              {loading ? '正在导入...' : `导入全部（${sheets.length} 个）`}
            </button>
            <button
              type="button"
              className="btn sheet-import-btn-secondary"
              disabled={loading || !selectedSheet}
              onClick={confirmImportSelected}
            >
              仅导入选中
            </button>
          </div>
        </div>
      )}

      {fileName && !pendingFile && (
        <div className="file-info">
          <FileSpreadsheet size={16} />
          <span>{fileName}</span>
          <button type="button" className="btn-icon" onClick={clearFile} aria-label="清除">
            <X size={14} />
          </button>
        </div>
      )}

      {info && !pendingFile && <p className="info-msg">{info}</p>}
      {error && <p className="error-msg">{error}</p>}
    </div>
  )
}
