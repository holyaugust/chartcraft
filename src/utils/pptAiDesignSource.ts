import type { PresentationOutline } from '../types/presentation'
import { outlineToPreviewText } from './presentationWrite'

export type AiDesignSourceOrigin = 'none' | 'inherited' | 'outline' | 'manual'

export interface AiDesignSource {
  file: File | null
  origin: AiDesignSourceOrigin
  displayName: string
}

interface SharedOutlineSource {
  file: File
  name: string
}

export function resolveAiDesignSource(
  shared: SharedOutlineSource | null | undefined,
  outline: PresentationOutline | null,
): AiDesignSource {
  if (shared?.file) {
    return { file: shared.file, origin: 'inherited', displayName: shared.name }
  }
  if (outline?.slides.length) {
    const text = outlineToPreviewText(outline)
    const safeTitle = (outline.title || '大纲').replace(/[/\\?%*:|"<>]/g, '_').slice(0, 80)
    const file = new File([text], `${safeTitle}.txt`, { type: 'text/plain' })
    return {
      file,
      origin: 'outline',
      displayName: `${safeTitle}.txt`,
    }
  }
  return { file: null, origin: 'none', displayName: '' }
}

export function aiDesignSourceHint(origin: AiDesignSourceOrigin): string | null {
  switch (origin) {
    case 'inherited':
      return '已沿用上一步上传的材料，无需重复上传'
    case 'outline':
      return '未检测到原文件，已根据当前大纲生成文本材料（Sidecar 将据此成稿）'
    case 'manual':
      return null
    default:
      return 'AI 设计稿需原始文件（支持 PDF）。若仅 PDF，可在此直接上传，无需先生成大纲'
  }
}
