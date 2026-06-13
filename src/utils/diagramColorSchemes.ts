import type { ColorSchemeId } from '../types'
import { COLOR_SCHEMES, contrastLabelColor, darkenColor, getColors, lightenColor } from './colorSchemes'

export interface DiagramColorTheme {
  id: ColorSchemeId
  label: string
  previewBackground: string
  exportBackground: string
  themeVariables: Record<string, string>
}

function buildTheme(id: ColorSchemeId): DiagramColorTheme {
  const scheme = COLOR_SCHEMES.find((item) => item.id === id) ?? COLOR_SCHEMES[0]
  const [primary, secondary, tertiary, accent, highlight] = getColors(id)
  const nodeFill = lightenColor(primary, 0.38)
  const nodeFillAlt = lightenColor(secondary, 0.32)
  const clusterFill = lightenColor(tertiary, 0.55)
  const previewBg =
    id === 'mono' || id === 'business'
      ? lightenColor(primary, 0.92)
      : `linear-gradient(145deg, ${lightenColor(primary, 0.9)} 0%, ${lightenColor(secondary, 0.93)} 100%)`

  return {
    id,
    label: scheme.label,
    previewBackground: previewBg,
    exportBackground: id === 'mono' ? '#f8fafc' : '#ffffff',
    themeVariables: {
      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      fontSize: '15px',
      primaryColor: nodeFill,
      primaryTextColor: contrastLabelColor(nodeFill),
      primaryBorderColor: primary,
      secondaryColor: nodeFillAlt,
      secondaryTextColor: contrastLabelColor(nodeFillAlt),
      secondaryBorderColor: secondary,
      tertiaryColor: lightenColor(tertiary, 0.28),
      tertiaryTextColor: contrastLabelColor(lightenColor(tertiary, 0.28)),
      tertiaryBorderColor: tertiary,
      lineColor: accent,
      textColor: '#0f172a',
      mainBkg: nodeFill,
      nodeBorder: primary,
      clusterBkg: clusterFill,
      clusterBorder: secondary,
      titleColor: darkenColor(primary, 0.1),
      edgeLabelBackground: '#ffffff',
      edgeLabelText: '#334155',
      noteBkgColor: lightenColor(highlight, 0.35),
      noteTextColor: '#0f172a',
      noteBorderColor: highlight,
      actorBorder: primary,
      actorBkg: nodeFill,
      actorTextColor: contrastLabelColor(nodeFill),
      signalColor: accent,
      signalTextColor: '#0f172a',
      labelBoxBkgColor: lightenColor(accent, 0.55),
      labelBoxBorderColor: accent,
      labelTextColor: '#0f172a',
      loopTextColor: primary,
      activationBorderColor: secondary,
      activationBkgColor: lightenColor(secondary, 0.45),
      sequenceNumberColor: '#ffffff',
    },
  }
}

export const DIAGRAM_COLOR_THEMES: DiagramColorTheme[] = COLOR_SCHEMES.map((scheme) =>
  buildTheme(scheme.id),
)

export const DEFAULT_DIAGRAM_COLOR_SCHEME_ID: ColorSchemeId = 'vivid'

export function getDiagramColorTheme(id: ColorSchemeId): DiagramColorTheme {
  return DIAGRAM_COLOR_THEMES.find((theme) => theme.id === id) ?? DIAGRAM_COLOR_THEMES[0]
}

/** 思维导图预览区渐变背景 */
export function getMindmapPreviewBackground(id: ColorSchemeId): string {
  const colors = getColors(id)
  const [c1, c2, c3] = colors
  return `radial-gradient(circle at 12% 18%, ${lightenColor(c1, 0.82)} 0%, transparent 42%),
    radial-gradient(circle at 88% 12%, ${lightenColor(c2, 0.84)} 0%, transparent 38%),
    radial-gradient(circle at 72% 88%, ${lightenColor(c3, 0.86)} 0%, transparent 40%),
    linear-gradient(145deg, #fafbff 0%, #ffffff 45%, #f8fafc 100%)`
}
