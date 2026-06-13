const DB_NAME = 'chartcraft-pptx'
const STORE_NAME = 'uploads'
const UPLOAD_KEY = 'current'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => reject(request.error ?? new Error('无法打开 PPT 缓存'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

export interface StoredUploadedPptx {
  fileName: string
  arrayBuffer: ArrayBuffer
}

export async function saveUploadedPptxDraft(fileName: string, arrayBuffer: ArrayBuffer): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('PPT 缓存写入失败'))
    tx.objectStore(STORE_NAME).put({ fileName, arrayBuffer }, UPLOAD_KEY)
  })
  db.close()
}

export async function loadUploadedPptxDraft(): Promise<StoredUploadedPptx | null> {
  const db = await openDb()
  const record = await new Promise<StoredUploadedPptx | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(UPLOAD_KEY)
    request.onerror = () => reject(request.error ?? new Error('PPT 缓存读取失败'))
    request.onsuccess = () => {
      const value = request.result as StoredUploadedPptx | undefined
      if (!value?.fileName || !value.arrayBuffer) {
        resolve(null)
        return
      }
      resolve(value)
    }
  })
  db.close()
  return record
}

export async function clearUploadedPptxDraft(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('PPT 缓存清除失败'))
    tx.objectStore(STORE_NAME).delete(UPLOAD_KEY)
  })
  db.close()
}
