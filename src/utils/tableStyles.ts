export type TableStyleId =
  | 'classic'
  | 'soft'
  | 'excel'
  | 'minimal'
  | 'outline'
  | 'card'
  | 'double'
  | 'modern'

export interface TableStyle {
  id: TableStyleId
  label: string
  description: string
  vars: Record<string, string>
}

function style(
  id: TableStyleId,
  label: string,
  description: string,
  vars: Record<string, string>,
): TableStyle {
  return { id, label, description, vars }
}

/** 边框与容器样式 — 与配色主题 CSS 变量协同 */
export const TABLE_STYLES: TableStyle[] = [
  style('classic', '经典网格', '均匀细线网格，清晰规整', {
    'table-radius': '10px',
    'table-outer-border-width': '1px',
    'table-outer-border-style': 'solid',
    'table-cell-border-width': '1px',
    'table-cell-border-style': 'solid',
    'table-grid-v': '1',
    'table-grid-h': '1',
    'table-axis-border-width': '1px',
    'table-title-border-width': '2px',
    'table-outer-shadow': 'inset 0 1px 0 rgba(255, 255, 255, 0.65)',
    'table-cell-gap': '0px',
  }),
  style('soft', '柔润圆角', '大圆角与柔和阴影，视觉轻盈', {
    'table-radius': '16px',
    'table-outer-border-width': '1px',
    'table-outer-border-style': 'solid',
    'table-cell-border-width': '1px',
    'table-cell-border-style': 'solid',
    'table-grid-v': '1',
    'table-grid-h': '1',
    'table-axis-border-width': '1px',
    'table-title-border-width': '2px',
    'table-outer-shadow': '0 8px 24px var(--table-outer-glow), inset 0 1px 0 rgba(255,255,255,0.8)',
    'table-cell-gap': '0px',
  }),
  style('excel', 'Excel 标准', '紧凑灰线，贴近 Excel 原生', {
    'table-radius': '4px',
    'table-outer-border-width': '1px',
    'table-outer-border-style': 'solid',
    'table-cell-border-width': '1px',
    'table-cell-border-style': 'solid',
    'table-grid-v': '1',
    'table-grid-h': '1',
    'table-axis-border-width': '1px',
    'table-title-border-width': '1px',
    'table-outer-shadow': 'none',
    'table-cell-gap': '0px',
  }),
  style('minimal', '极简留白', '仅水平分隔，留白更多', {
    'table-radius': '12px',
    'table-outer-border-width': '1px',
    'table-outer-border-style': 'solid',
    'table-cell-border-width': '1px',
    'table-cell-border-style': 'solid',
    'table-grid-v': '0',
    'table-grid-h': '1',
    'table-axis-border-width': '1px',
    'table-title-border-width': '2px',
    'table-outer-shadow': '0 4px 16px var(--table-outer-glow)',
    'table-cell-gap': '0px',
  }),
  style('outline', '线框强调', '外框加粗，网格带主题色', {
    'table-radius': '10px',
    'table-outer-border-width': '2px',
    'table-outer-border-style': 'solid',
    'table-cell-border-width': '1px',
    'table-cell-border-style': 'solid',
    'table-grid-v': '1',
    'table-grid-h': '1',
    'table-axis-border-width': '2px',
    'table-title-border-width': '2px',
    'table-outer-shadow': '0 0 0 1px var(--table-accent-soft)',
    'table-cell-gap': '0px',
  }),
  style('card', '卡片悬浮', '卡片式外框与层次阴影', {
    'table-radius': '18px',
    'table-outer-border-width': '1px',
    'table-outer-border-style': 'solid',
    'table-cell-border-width': '1px',
    'table-cell-border-style': 'solid',
    'table-grid-v': '1',
    'table-grid-h': '1',
    'table-axis-border-width': '1px',
    'table-title-border-width': '2px',
    'table-outer-shadow':
      '0 12px 32px -8px var(--table-outer-glow), 0 4px 12px rgba(15, 23, 42, 0.06)',
    'table-cell-gap': '0px',
  }),
  style('double', '双线典雅', '双线外框，正式文档感', {
    'table-radius': '8px',
    'table-outer-border-width': '3px',
    'table-outer-border-style': 'double',
    'table-cell-border-width': '1px',
    'table-cell-border-style': 'solid',
    'table-grid-v': '1',
    'table-grid-h': '1',
    'table-axis-border-width': '2px',
    'table-title-border-width': '2px',
    'table-outer-shadow': 'none',
    'table-cell-gap': '0px',
  }),
  style('modern', '渐变边框', '主题色渐变外框，现代感', {
    'table-radius': '14px',
    'table-outer-border-width': '2px',
    'table-outer-border-style': 'solid',
    'table-cell-border-width': '1px',
    'table-cell-border-style': 'solid',
    'table-grid-v': '1',
    'table-grid-h': '1',
    'table-axis-border-width': '1px',
    'table-title-border-width': '2px',
    'table-outer-shadow': '0 6px 20px var(--table-outer-glow)',
    'table-cell-gap': '0px',
  }),
]

export const DEFAULT_TABLE_STYLE: TableStyleId = 'classic'

export function getTableStyle(id: TableStyleId): TableStyle {
  return TABLE_STYLES.find((s) => s.id === id) ?? TABLE_STYLES[0]
}

export function getTableStyleVars(id: TableStyleId): Record<string, string> {
  const vars = getTableStyle(id).vars
  return Object.fromEntries(Object.entries(vars).map(([key, value]) => [`--${key}`, value]))
}
