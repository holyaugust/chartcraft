const WRITE_MATERIALS_KEY = 'chartcraft-write-materials'

export interface WriteReferenceFile {
  id: string
  name: string
  text: string
}

export interface WriteMaterialsDraft {
  prompt: string
  autoReference: boolean
  saveMaterials: boolean
  referenceFiles: WriteReferenceFile[]
  imitationFiles: WriteReferenceFile[]
  typeId: string
  subtypeId: string | null
}

const DEFAULT_MATERIALS: WriteMaterialsDraft = {
  prompt: '',
  autoReference: true,
  saveMaterials: true,
  referenceFiles: [],
  imitationFiles: [],
  typeId: 'auto',
  subtypeId: null,
}

export function loadWriteMaterials(): WriteMaterialsDraft {
  try {
    const raw = localStorage.getItem(WRITE_MATERIALS_KEY)
    if (!raw) return { ...DEFAULT_MATERIALS }
    const parsed = JSON.parse(raw) as Partial<WriteMaterialsDraft>
    return {
      ...DEFAULT_MATERIALS,
      ...parsed,
      referenceFiles: Array.isArray(parsed.referenceFiles) ? parsed.referenceFiles : [],
      imitationFiles: Array.isArray(parsed.imitationFiles) ? parsed.imitationFiles : [],
    }
  } catch {
    return { ...DEFAULT_MATERIALS }
  }
}

export function saveWriteMaterials(draft: WriteMaterialsDraft): void {
  if (!draft.saveMaterials) {
    try {
      localStorage.removeItem(WRITE_MATERIALS_KEY)
    } catch {
      /* ignore */
    }
    return
  }

  try {
    localStorage.setItem(WRITE_MATERIALS_KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}
