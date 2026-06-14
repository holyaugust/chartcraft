export interface SaveFileOptions {
  suggestedName: string
  description?: string
  accept?: Record<string, string[]>
}

export interface SaveFileSession {
  /** 将 blob 写入 beginSaveFile 时用户选择的路径（或回退下载） */
  write: (blob: Blob) => Promise<boolean>
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

function buildPickerTypes(options: SaveFileOptions) {
  const { suggestedName, description, accept } = options
  if (!accept) return undefined
  return [
    {
      description: description ?? suggestedName,
      accept,
    },
  ]
}

function isSavePickerGestureError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'SecurityError' || err.name === 'NotAllowedError'
  }
  if (err instanceof Error) {
    return err.message.includes('user gesture') || err.message.includes('showSaveFilePicker')
  }
  return false
}

/**
 * 在用户点击时立即弹出「另存为」，返回写入会话。
 * 长时间异步任务完成后调用 session.write(blob)，无需再次弹出对话框。
 * 用户取消时返回 null；不支持 File System Access API 时 write 回退为浏览器下载。
 */
export async function beginSaveFile(options: SaveFileOptions): Promise<SaveFileSession | null> {
  const pickerWindow = window as SaveFilePickerWindow

  if (typeof pickerWindow.showSaveFilePicker === 'function') {
    try {
      const handle = await pickerWindow.showSaveFilePicker({
        suggestedName: options.suggestedName,
        types: buildPickerTypes(options),
      })
      return {
        write: async (blob) => {
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
          return true
        },
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null
      }
      throw err
    }
  }

  return {
    write: async (blob) => {
      downloadBlob(blob, options.suggestedName)
      return true
    },
  }
}

/** 弹出系统「另存为」对话框；不支持时回退为浏览器下载。用户取消时返回 false。 */
export async function saveFile(blob: Blob, options: SaveFileOptions): Promise<boolean> {
  const session = await beginSaveFile(options)
  if (!session) return false

  try {
    return await session.write(blob)
  } catch (err) {
    if (isSavePickerGestureError(err)) {
      downloadBlob(blob, options.suggestedName)
      return true
    }
    throw err
  }
}
