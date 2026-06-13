import type { SmartGraphicColorSchemeId } from '../types/smartGraphic'

export interface SmartGraphicColorTheme {
  id: SmartGraphicColorSchemeId
  label: string
  primary: string
  secondary: string
  accent: string
  palette: string[]
  background: string
  text: string
  muted: string
}

export const SMART_GRAPHIC_COLOR_THEMES: SmartGraphicColorTheme[] = [
  {
    id: 'blue',
    label: '商务蓝',
    primary: '#2563eb',
    secondary: '#3b82f6',
    accent: '#0ea5e9',
    palette: ['#2563eb', '#3b82f6', '#0ea5e9', '#06b6d4', '#6366f1', '#8b5cf6'],
    background: '#fafbfd',
    text: '#0f172a',
    muted: '#64748b',
  },
  {
    id: 'teal',
    label: '清新青',
    primary: '#0d9488',
    secondary: '#14b8a6',
    accent: '#06b6d4',
    palette: ['#0d9488', '#14b8a6', '#06b6d4', '#0891b2', '#059669', '#10b981'],
    background: '#fafbfd',
    text: '#0f172a',
    muted: '#64748b',
  },
  {
    id: 'violet',
    label: '极光紫',
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#a855f7',
    palette: ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#3b82f6', '#06b6d4'],
    background: '#fafbfd',
    text: '#0f172a',
    muted: '#64748b',
  },
  {
    id: 'orange',
    label: '活力橙',
    primary: '#ea580c',
    secondary: '#f97316',
    accent: '#fb923c',
    palette: ['#ea580c', '#f97316', '#fb923c', '#f59e0b', '#ef4444', '#eab308'],
    background: '#fafbfd',
    text: '#0f172a',
    muted: '#64748b',
  },
  {
    id: 'slate',
    label: '简约灰',
    primary: '#334155',
    secondary: '#475569',
    accent: '#64748b',
    palette: ['#334155', '#475569', '#64748b', '#94a3b8', '#0ea5e9', '#6366f1'],
    background: '#fafbfd',
    text: '#0f172a',
    muted: '#64748b',
  },
  {
    id: 'rose',
    label: '柔和粉',
    primary: '#e11d48',
    secondary: '#f43f5e',
    accent: '#fb7185',
    palette: ['#e11d48', '#f43f5e', '#fb7185', '#ec4899', '#8b5cf6', '#6366f1'],
    background: '#fafbfd',
    text: '#0f172a',
    muted: '#64748b',
  },
]

export function getSmartGraphicColorTheme(id: SmartGraphicColorSchemeId): SmartGraphicColorTheme {
  return SMART_GRAPHIC_COLOR_THEMES.find((theme) => theme.id === id) ?? SMART_GRAPHIC_COLOR_THEMES[0]
}
