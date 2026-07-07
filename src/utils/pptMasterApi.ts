import type { PptMasterGenerationMode, PptMasterHealth, PptMasterJobRecord, PptMasterStyle } from '../types/pptMaster'

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

export async function fetchPptMasterHealth(): Promise<PptMasterHealth> {
  const response = await fetch(`${baseUrl()}/health`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return (await response.json()) as PptMasterHealth
}

export async function createPptMasterJob(input: {
  file?: File | null
  prompt: string
  style: PptMasterStyle
  styleNote?: string
  primaryColor?: string
  referenceImageUrl?: string
  generationMode?: PptMasterGenerationMode
  referenceImages?: File[]
}): Promise<{ job_id: string }> {
  const form = new FormData()
  if (input.file) {
    form.append('file', input.file)
  }
  form.append('prompt', input.prompt)
  form.append('style', input.style)
  form.append('generation_mode', input.generationMode ?? 'creative')
  if (input.styleNote?.trim()) {
    form.append('style_note', input.styleNote.trim())
  }
  if (input.primaryColor?.trim()) {
    form.append('primary_color', input.primaryColor.trim())
  }
  if (input.referenceImageUrl?.trim()) {
    form.append('reference_image_url', input.referenceImageUrl.trim())
  }
  for (const image of input.referenceImages ?? []) {
    form.append('reference_images', image)
  }

  const response = await fetch(`${baseUrl()}/jobs`, {
    method: 'POST',
    body: form,
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return (await response.json()) as { job_id: string }
}

export async function fetchPptMasterJob(jobId: string): Promise<PptMasterJobRecord> {
  const response = await fetch(`${baseUrl()}/jobs/${jobId}`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return (await response.json()) as PptMasterJobRecord
}

export async function downloadPptMasterJob(jobId: string): Promise<Blob> {
  const response = await fetch(`${baseUrl()}/jobs/${jobId}/download`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.blob()
}

export function pollPptMasterJob(
  jobId: string,
  onUpdate: (record: PptMasterJobRecord) => void,
  intervalMs = 2000,
): () => void {
  let stopped = false

  const tick = async () => {
    if (stopped) return
    try {
      const record = await fetchPptMasterJob(jobId)
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
