export interface SaveFileOptions {
  suggestedName: string
  description?: string
  accept?: Record<string, string[]>
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string
    types?: Array<{ description: string; accept: Record<string, string[]> }>
  }) => Promise<FileSystemFileHandle>
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** 弹出系统「另存为」对话框；不支持时回退为浏览器下载。用户取消时返回 false。 */
export async function saveFile(blob: Blob, options: SaveFileOptions): Promise<boolean> {
  const { suggestedName, description, accept } = options

  const pickerWindow = window as SaveFilePickerWindow

  if (typeof pickerWindow.showSaveFilePicker === 'function') {
    try {
      const handle = await pickerWindow.showSaveFilePicker({
        suggestedName,
        types: accept
          ? [
              {
                description: description ?? suggestedName,
                accept,
              },
            ]
          : undefined,
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return true
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return false
      }
      throw err
    }
  }

  downloadBlob(blob, suggestedName)
  return true
}
