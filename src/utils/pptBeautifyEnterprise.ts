/**
 * 第二/三阶段：企业模板与全局主题（骨架）
 */
import type { PptEnterpriseTemplate, PptGlobalThemePatch } from '../types/pptBeautify'

const META_KEY = 'chartcraft-ppt-enterprise-templates'
const DB_NAME = 'chartcraft-ppt-beautify'
const STORE = 'enterprise-templates'

export function loadEnterpriseTemplateMeta(): PptEnterpriseTemplate[] {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PptEnterpriseTemplate[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveEnterpriseTemplateMeta(templates: PptEnterpriseTemplate[]): void {
  localStorage.setItem(META_KEY, JSON.stringify(templates))
}

export async function saveEnterpriseTemplateBinary(id: string, buffer: ArrayBuffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'))
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(buffer, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('模板保存失败'))
    }
  })
}

export async function loadEnterpriseTemplateBinary(id: string): Promise<ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'))
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        resolve(null)
        return
      }
      const tx = db.transaction(STORE, 'readonly')
      const getReq = tx.objectStore(STORE).get(id)
      getReq.onsuccess = () => resolve((getReq.result as ArrayBuffer | undefined) ?? null)
      getReq.onerror = () => reject(getReq.error ?? new Error('模板读取失败'))
    }
  })
}

/** 第三阶段预留：全局主题一键替换 */
export function applyGlobalThemePatch(_buffer: ArrayBuffer, _patch: PptGlobalThemePatch): Promise<ArrayBuffer> {
  return Promise.reject(new Error('第三阶段「主题一键全局替换」尚未开放，敬请期待'))
}

export async function registerEnterpriseTemplate(input: {
  name: string
  fileName: string
  buffer: ArrayBuffer
  pageTypes: string[]
}): Promise<PptEnterpriseTemplate> {
  const meta: PptEnterpriseTemplate = {
    id: `ent-${Date.now()}`,
    name: input.name,
    fileName: input.fileName,
    pageTypes: input.pageTypes,
    uploadedAt: Date.now(),
  }
  await saveEnterpriseTemplateBinary(meta.id, input.buffer)
  const list = loadEnterpriseTemplateMeta()
  list.unshift(meta)
  saveEnterpriseTemplateMeta(list)
  return meta
}
