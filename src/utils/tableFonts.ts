export interface TableFontOption {
  id: string
  label: string
  family: string
}

export const TABLE_FONT_OPTIONS: TableFontOption[] = [
  { id: 'microsoft-yahei', label: '微软雅黑', family: "'Microsoft YaHei', sans-serif" },
  { id: 'simsun', label: '宋体', family: 'SimSun, serif' },
  { id: 'simhei', label: '黑体', family: 'SimHei, sans-serif' },
  { id: 'arial', label: 'Arial', family: 'Arial, sans-serif' },
  { id: 'calibri', label: 'Calibri', family: 'Calibri, sans-serif' },
  { id: 'times-new-roman', label: 'Times New Roman', family: "'Times New Roman', serif" },
  { id: 'monospace', label: '等宽', family: 'ui-monospace, Consolas, monospace' },
]

export const TABLE_FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24] as const

export const DEFAULT_FONT_ID = TABLE_FONT_OPTIONS[0].id
export const DEFAULT_FONT_FAMILY = TABLE_FONT_OPTIONS[0].family
export const DEFAULT_FONT_SIZE = 13

const LEGACY_FONT_FAMILY_MAP: Record<string, string> = Object.fromEntries(
  TABLE_FONT_OPTIONS.map((font) => [font.family, font.id]),
)

export function resolveFontFamily(stored?: string): string {
  if (!stored) return DEFAULT_FONT_FAMILY
  const byId = TABLE_FONT_OPTIONS.find((font) => font.id === stored)
  if (byId) return byId.family
  if (LEGACY_FONT_FAMILY_MAP[stored]) {
    return TABLE_FONT_OPTIONS.find((font) => font.id === LEGACY_FONT_FAMILY_MAP[stored])!.family
  }
  return stored
}

export function resolveFontId(stored?: string): string {
  if (!stored) return DEFAULT_FONT_ID
  const byId = TABLE_FONT_OPTIONS.find((font) => font.id === stored)
  if (byId) return byId.id
  if (LEGACY_FONT_FAMILY_MAP[stored]) return LEGACY_FONT_FAMILY_MAP[stored]
  const matched = TABLE_FONT_OPTIONS.find((font) => font.family === stored)
  return matched?.id ?? DEFAULT_FONT_ID
}

/** @deprecated use TABLE_FONT_OPTIONS */
export const TABLE_FONT_FAMILIES = TABLE_FONT_OPTIONS.map((font) => ({
  label: font.label,
  value: font.family,
}))
