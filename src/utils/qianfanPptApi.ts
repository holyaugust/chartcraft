import type {
  QianfanGenMode,
  QianfanLayoutMode,
  QianfanPageRange,
  QianfanPptHealth,
  QianfanPptJobRecord,
  QianfanPptTheme,
} from '../types/qianfanPpt'

const DEFAULT_BASE = '/api/ppt-master'

function baseUrl(): string {
  const configured = (import.meta.env.VITE_PPT_MASTER_API_URL as string | undefined)?.trim()
  return configured || DEFAULT_BASE
}

async function parseError(response: Response): Promise<string> {
  if (response.status === 502) {
    return 'PPT 后端未响应（502），请先在本机运行 npm run dev:ppt-api'
  }
  try {
    const payload = (await response.json()) as { detail?: string }
    if (payload.detail) return payload.detail
  } catch {
    /* ignore */
  }
  return `请求失败（${response.status}）`
}

export async function fetchQianfanPptHealth(): Promise<QianfanPptHealth> {
  const response = await fetch(`${baseUrl()}/qianfan/health`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return (await response.json()) as QianfanPptHealth
}

export async function fetchQianfanPptThemes(): Promise<QianfanPptTheme[]> {
  const response = await fetch(`${baseUrl()}/qianfan/themes`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  const payload = (await response.json()) as { themes: QianfanPptTheme[] }
  return payload.themes ?? []
}

export async function createQianfanPptJob(input: {
  file: File
  prompt: string
  tpl_id: number
  style_id: number
  page_range: QianfanPageRange
  layout: QianfanLayoutMode
  gen_mode: QianfanGenMode
  resource_url?: string
}): Promise<{ job_id: string }> {
  const form = new FormData()
  form.append('file', input.file)
  form.append('prompt', input.prompt)
  form.append('tpl_id', String(input.tpl_id))
  form.append('style_id', String(input.style_id))
  form.append('page_range', input.page_range)
  form.append('layout', input.layout)
  form.append('gen_mode', String(input.gen_mode))
  if (input.resource_url?.trim()) {
    form.append('resource_url', input.resource_url.trim())
  }

  const response = await fetch(`${baseUrl()}/qianfan/jobs`, {
    method: 'POST',
    body: form,
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return (await response.json()) as { job_id: string }
}

export async function fetchQianfanPptJob(jobId: string): Promise<QianfanPptJobRecord> {
  const response = await fetch(`${baseUrl()}/qianfan/jobs/${jobId}`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return (await response.json()) as QianfanPptJobRecord
}

export async function downloadQianfanPptJob(jobId: string): Promise<Blob> {
  const response = await fetch(`${baseUrl()}/qianfan/jobs/${jobId}/download`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.blob()
}

export function pollQianfanPptJob(
  jobId: string,
  onUpdate: (record: QianfanPptJobRecord) => void,
  intervalMs = 2000,
): () => void {
  let stopped = false

  const tick = async () => {
    if (stopped) return
    try {
      const record = await fetchQianfanPptJob(jobId)
      onUpdate(record)
      if (record.status === 'succeeded' || record.status === 'failed') {
        stopped = true
        return
      }
    } catch {
      /* 轮询继续 */
    }
    if (!stopped) {
      window.setTimeout(() => void tick(), intervalMs)
    }
  }

  void tick()
  return () => {
    stopped = true
  }
}
