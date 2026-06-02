import type { TableStyleId } from './tableStyles'
import { DEFAULT_TABLE_STYLE, getTableStyleVars, TABLE_STYLES } from './tableStyles'
import type { TableThemeId } from './tableThemes'
import { DEFAULT_TABLE_THEME, getTableThemeStyle, TABLE_THEMES } from './tableThemes'

export interface TableAppearance {
  theme: TableThemeId
  style: TableStyleId
  /** 是否显示 Excel 式行列标号（A/B/C、1/2/3） */
  showSheetAxis?: boolean
}

export const TABLE_APPEARANCE_STORAGE_KEY = 'chartcraft-table-appearance'

export const DEFAULT_TABLE_APPEARANCE: TableAppearance = {
  theme: DEFAULT_TABLE_THEME,
  style: DEFAULT_TABLE_STYLE,
  showSheetAxis: true,
}

function isValidTheme(id: unknown): id is TableThemeId {
  return typeof id === 'string' && TABLE_THEMES.some((t) => t.id === id)
}

function isValidStyle(id: unknown): id is TableStyleId {
  return typeof id === 'string' && TABLE_STYLES.some((s) => s.id === id)
}

export function getTableAppearanceStyle(theme: TableThemeId, style: TableStyleId): Record<string, string> {
  return {
    ...getTableThemeStyle(theme),
    ...getTableStyleVars(style),
  }
}

export function loadTableAppearance(): TableAppearance {
  try {
    const raw = localStorage.getItem(TABLE_APPEARANCE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TableAppearance>
      return {
        theme: isValidTheme(parsed.theme) ? parsed.theme : DEFAULT_TABLE_THEME,
        style: isValidStyle(parsed.style) ? parsed.style : DEFAULT_TABLE_STYLE,
        showSheetAxis: parsed.showSheetAxis !== false,
      }
    }
    const legacyTheme = localStorage.getItem('chartcraft-table-theme')
    if (isValidTheme(legacyTheme)) {
      return { theme: legacyTheme, style: DEFAULT_TABLE_STYLE }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_TABLE_APPEARANCE
}

export function saveTableAppearance(appearance: TableAppearance): void {
  try {
    localStorage.setItem(TABLE_APPEARANCE_STORAGE_KEY, JSON.stringify(appearance))
  } catch {
    /* ignore */
  }
}
