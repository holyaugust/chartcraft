/** 与 scripts/ppt-layout-styles.mjs 对齐 */
export type PptFullLayoutStyle =
  | 'classic-bar'
  | 'side-rail'
  | 'tech-angular'
  | 'hero-center'
  | 'editorial'
  | 'magazine'
  | 'split-panel'
  | 'gala-gold'
  | 'wave-soft'
  | 'timeline'

export const PPT_LAYOUT_STYLE_LABELS: Record<PptFullLayoutStyle, string> = {
  'classic-bar': '经典顶栏',
  'side-rail': '侧栏标题',
  'tech-angular': '科技斜切',
  'hero-center': '居中大气',
  editorial: '杂志留白',
  magazine: '杂志大图',
  'split-panel': '分栏对比',
  'gala-gold': '盛典黑金',
  'wave-soft': '波浪清新',
  timeline: '时间轴',
}

export const PPT_THEME_LAYOUT_MAP: Record<string, PptFullLayoutStyle> = {
  'green-academic': 'classic-bar',
  'blue-business': 'side-rail',
  'dark-modern': 'tech-angular',
  'red-corporate': 'hero-center',
  'minimal-gray': 'editorial',
  'purple-luxe': 'magazine',
  'sunrise-warm': 'split-panel',
  'black-gold': 'gala-gold',
  'ocean-breeze': 'wave-soft',
  'neon-tech': 'timeline',
}

export function resolveThemeLayoutStyle(themeId: string): PptFullLayoutStyle {
  return PPT_THEME_LAYOUT_MAP[themeId] ?? 'classic-bar'
}
