/**
 * 多版式幻灯片构建器 — CC_* 占位符位置保持一致，供 pptx 写回
 */
import { PPT_LAYOUT_STYLES as L } from './ppt-layout-styles.mjs'

export const FONT = 'Microsoft YaHei'
export const BULLET_SLOTS = 5
export const BULLET_ROW_H = 0.58
export const BULLET_ROW_GAP = 0.1
export const BULLET_ROW_START = 1.38
export const BULLET_ROW_Y = Array.from({ length: BULLET_SLOTS }, (_, i) =>
  BULLET_ROW_START + i * (BULLET_ROW_H + BULLET_ROW_GAP),
)
export const CONTENT_CARD_X = 0.45
export const CONTENT_CARD_W = 9.1
export const CONTENT_CARD_H = 3.82
export const CONTENT_CARD_Y = 1.18
const CARD_RADIUS = 0.07
const ROW_RADIUS = 0.14
const BADGE_SIZE = 0.36
const BADGE_RADIUS = 0.38
const PILL_RADIUS = 0.5
const FOOTER_X = 0.12
const FOOTER_W = 9.88
const FOOTER_ACCENT_W = FOOTER_W * 0.28

function layoutOf(theme) {
  return theme.layout ?? L.CLASSIC
}

function addAccentBar(slide, theme) {
  slide.addShape('rect', { x: 0, y: 0, w: 0.12, h: 5.625, fill: { color: theme.accent } })
}

function coverMeta(slide, theme, opts = {}) {
  const { titleX = 0.55, titleY = 1.65, titleW = 8.8, titleAlign = 'left', titleSize = 32, subY = 2.95 } = opts
  slide.addText('CC_COVER_TITLE', {
    x: titleX, y: titleY, w: titleW, h: 1.2, fontSize: titleSize, bold: true,
    color: theme.titleColor, fontFace: FONT, align: titleAlign,
  })
  slide.addText('CC_COVER_SUBTITLE', {
    x: titleX, y: subY, w: titleW, h: 0.75, fontSize: 16,
    color: theme.subtitleColor, fontFace: FONT, align: titleAlign,
  })
  slide.addText('CC_COVER_AUTHOR', {
    x: 0.55, y: 5.15, w: 4, h: 0.35, fontSize: 12, color: theme.footerColor, fontFace: FONT,
  })
  slide.addText('CC_COVER_DATE', {
    x: 5.5, y: 5.15, w: 3.95, h: 0.35, fontSize: 12, color: theme.footerColor, align: 'right', fontFace: FONT,
  })
}

export function addCoverSlide(pptx, theme) {
  const slide = pptx.addSlide()
  const layout = layoutOf(theme)
  slide.background = { color: theme.background }

  if (layout === L.HERO || layout === L.GALA) {
    slide.addShape('ellipse', { x: 6.5, y: -0.5, w: 4.2, h: 3.8, fill: { color: theme.accent, transparency: 82 }, line: { width: 0 } })
    slide.addShape('ellipse', { x: -1, y: 4, w: 3.5, h: 3, fill: { color: theme.primaryColor, transparency: 88 }, line: { width: 0 } })
    if (layout === L.GALA) {
      slide.addShape('rect', { x: 1.5, y: 1.55, w: 7, h: 0.04, fill: { color: theme.accent } })
      slide.addShape('rect', { x: 1.5, y: 3.55, w: 7, h: 0.04, fill: { color: theme.accent } })
    }
    coverMeta(slide, theme, { titleX: 0.8, titleY: 1.85, titleW: 8.4, titleAlign: 'center', titleSize: 36, subY: 3.05 })
    return
  }

  if (layout === L.SPLIT) {
    slide.addShape('rect', { x: 0, y: 0, w: 3.6, h: 5.625, fill: { color: theme.headerFill } })
    slide.addShape('rect', { x: 3.6, y: 0, w: 6.4, h: 5.625, fill: { color: theme.pageBg } })
    slide.addShape('rect', { x: 3.55, y: 0, w: 0.08, h: 5.625, fill: { color: theme.accent } })
    coverMeta(slide, theme, {
      titleX: 3.95, titleY: 1.55, titleW: 5.6, titleAlign: 'left', titleSize: 28, subY: 2.85,
    })
    slide.addText('CC_COVER_TITLE', { x: 3.95, y: 1.55, w: 5.6, h: 1.2, fontSize: 28, bold: true, color: theme.primaryColor, fontFace: FONT })
    slide.addText('CC_COVER_SUBTITLE', { x: 3.95, y: 2.85, w: 5.6, h: 0.75, fontSize: 15, color: theme.contentBody, fontFace: FONT })
    return
  }

  if (layout === L.EDITORIAL) {
    slide.background = { color: theme.pageBg }
    slide.addShape('rect', { x: 0.55, y: 0.55, w: 1.2, h: 0.06, fill: { color: theme.accent } })
    coverMeta(slide, theme, {
      titleX: 0.55, titleY: 1.35, titleW: 8.5, titleAlign: 'left', titleSize: 34, subY: 2.65,
    })
    slide.addText('CC_COVER_TITLE', { x: 0.55, y: 1.35, w: 8.5, h: 1.2, fontSize: 34, bold: true, color: theme.primaryColor, fontFace: FONT })
    slide.addText('CC_COVER_SUBTITLE', { x: 0.55, y: 2.65, w: 8.5, h: 0.75, fontSize: 15, color: theme.contentBody, fontFace: FONT })
    slide.addText('CC_COVER_AUTHOR', { x: 0.55, y: 5.15, w: 4, h: 0.35, fontSize: 12, color: theme.contentBody, fontFace: FONT })
    slide.addText('CC_COVER_DATE', { x: 5.5, y: 5.15, w: 3.95, h: 0.35, fontSize: 12, color: theme.contentBody, align: 'right', fontFace: FONT })
    return
  }

  if (layout === L.MAGAZINE) {
    slide.addShape('rect', { x: 0, y: 3.35, w: 10, h: 2.275, fill: { color: theme.headerFill } })
    slide.addShape('ellipse', { x: 7, y: 0.2, w: 3.5, h: 3, fill: { color: theme.accent, transparency: 75 }, line: { width: 0 } })
    coverMeta(slide, theme, { titleX: 0.65, titleY: 3.65, titleW: 8.7, titleAlign: 'left', titleSize: 30, subY: 4.55 })
    return
  }

  if (layout === L.TECH) {
    slide.addShape('rect', { x: 5.5, y: -0.8, w: 6, h: 3.5, fill: { color: theme.accent, transparency: 88 }, rotate: 24 })
    slide.addShape('rect', { x: 0, y: 4.85, w: 10, h: 0.06, fill: { color: theme.accent } })
    addAccentBar(slide, theme)
    coverMeta(slide, theme, { titleSize: 34, subY: 3.05 })
    return
  }

  if (layout === L.WAVE) {
    slide.addShape('ellipse', { x: -0.5, y: 4.2, w: 5, h: 2.2, fill: { color: theme.accent, transparency: 70 }, line: { width: 0 } })
    slide.addShape('ellipse', { x: 6.5, y: -0.3, w: 4, h: 2.5, fill: { color: theme.headerFillLight, transparency: 78 }, line: { width: 0 } })
    slide.addShape('roundRect', { x: 0.55, y: 0.45, w: 1.4, h: 0.28, rectRadius: PILL_RADIUS, fill: { color: theme.accent, transparency: 25 }, line: { width: 0 } })
    coverMeta(slide, theme)
    if (theme.id !== 'minimal-gray') {
      slide.addShape('rect', { x: 0, y: 5.1, w: 10, h: 0.55, fill: { color: theme.accent, transparency: 35 } })
    }
    return
  }

  // classic-bar / side-rail / timeline default cover
  if (theme.id !== 'minimal-gray') {
    slide.addShape('rect', { x: 0, y: 5.1, w: 10, h: 0.55, fill: { color: theme.accent, transparency: 35 } })
  }
  addAccentBar(slide, theme)
  coverMeta(slide, theme)
}

export function addSectionSlide(pptx, theme) {
  const slide = pptx.addSlide()
  const layout = layoutOf(theme)
  slide.background = { color: theme.background }

  if (layout === L.HERO || layout === L.GALA) {
    slide.addShape('ellipse', { x: 3.5, y: 0.5, w: 3, h: 3, line: { color: theme.accent, width: 2 }, fill: { color: theme.background, transparency: 100 } })
    slide.addText('CC_SECTION_TITLE', {
      x: 0.8, y: 2.0, w: 8.4, h: 1.3, fontSize: 38, bold: true, color: theme.titleColor, align: 'center', fontFace: FONT,
    })
    return
  }

  if (layout === L.SPLIT) {
    slide.addShape('rect', { x: 0, y: 0, w: 4.2, h: 5.625, fill: { color: theme.headerFill } })
    slide.addText('CC_SECTION_TITLE', {
      x: 0.45, y: 2.0, w: 3.3, h: 1.4, fontSize: 28, bold: true, color: theme.titleColor, align: 'left', fontFace: FONT, valign: 'middle',
    })
    slide.addShape('rect', { x: 4.2, y: 2.35, w: 5.5, h: 0.06, fill: { color: theme.accent } })
    return
  }

  if (layout === L.EDITORIAL) {
    slide.background = { color: theme.pageBg }
    slide.addText('SECTION', {
      x: 0.55, y: 1.5, w: 2, h: 0.3, fontSize: 10, bold: true, color: theme.accent, fontFace: FONT, charSpacing: 2,
    })
    slide.addText('CC_SECTION_TITLE', {
      x: 0.55, y: 1.95, w: 8.5, h: 1.3, fontSize: 36, bold: true, color: theme.primaryColor, align: 'left', fontFace: FONT,
    })
    slide.addShape('rect', { x: 0.55, y: 3.45, w: 2.5, h: 0.05, fill: { color: theme.accent } })
    return
  }

  if (layout === L.MAGAZINE) {
    slide.addShape('rect', { x: 0, y: 0, w: 10, h: 1.1, fill: { color: theme.accent } })
    slide.addText('CC_SECTION_TITLE', {
      x: 0.55, y: 2.05, w: 8.8, h: 1.3, fontSize: 40, bold: true, color: theme.titleColor, align: 'left', fontFace: FONT,
    })
    return
  }

  if (layout === L.TECH) {
    slide.addShape('rect', { x: 0, y: 0, w: 10, h: 0.08, fill: { color: theme.accent } })
    slide.addShape('rect', { x: 7.5, y: 0.08, w: 2.5, h: 5.545, fill: { color: theme.accent, transparency: 92 } })
    slide.addText('CC_SECTION_TITLE', {
      x: 0.55, y: 2.05, w: 7, h: 1.3, fontSize: 34, bold: true, color: theme.titleColor, align: 'left', fontFace: FONT,
    })
    return
  }

  if (layout === L.TIMELINE) {
    addAccentBar(slide, theme)
    slide.addShape('rect', { x: 0.55, y: 2.85, w: 8.8, h: 0.55, fill: { color: theme.accent, transparency: 35 } })
    slide.addText('CC_SECTION_TITLE', {
      x: 0.55, y: 2.05, w: 8.8, h: 1.2, fontSize: 36, bold: true, color: theme.titleColor, align: 'left', fontFace: FONT,
    })
    return
  }

  // classic / side-rail / wave
  addAccentBar(slide, theme)
  slide.addShape('rect', { x: 0, y: 5.15, w: 10, h: 0.47, fill: { color: theme.accent, transparency: 40 } })
  slide.addShape('ellipse', { x: 8.55, y: 0.35, w: 0.85, h: 0.85, line: { color: theme.accent, width: 1.5 }, fill: { color: theme.background, transparency: 100 } })
  slide.addText('CC_SECTION_TITLE', {
    x: 0.55, y: 2.15, w: 8.8, h: 1.2, fontSize: 36, bold: true, color: theme.titleColor, align: 'center', fontFace: FONT,
  })
}

function addMeshDecorations(slide, theme) {
  slide.addShape('ellipse', { x: 7.35, y: -0.2, w: 3.0, h: 2.6, fill: { color: theme.accent, transparency: 72 }, line: { width: 0 } })
  slide.addShape('ellipse', { x: -0.85, y: 3.95, w: 3.2, h: 2.9, fill: { color: theme.primaryColor, transparency: 85 }, line: { width: 0 } })
}

function addBulletCardRow(slide, theme, slotIndex, rowY) {
  const num = String(slotIndex + 1).padStart(2, '0')
  const ROW_X = 0.58
  const ROW_W = 8.84
  const badgeX = ROW_X + 0.14
  const badgeY = rowY + (BULLET_ROW_H - BADGE_SIZE) / 2
  const layout = layoutOf(theme)

  if (layout === L.EDITORIAL) {
    slide.addShape('ellipse', { x: ROW_X + 0.08, y: rowY + 0.2, w: 0.12, h: 0.12, fill: { color: theme.accent } })
    slide.addText(`CC_BULLET_${slotIndex + 1}`, {
      x: ROW_X + 0.32, y: rowY + 0.06, w: 8.0, h: 0.42, fontSize: 12, color: theme.contentBody, fontFace: FONT,
    })
    if (slotIndex < BULLET_SLOTS - 1) {
      slide.addShape('rect', { x: ROW_X, y: rowY + BULLET_ROW_H + 0.02, w: ROW_W, h: 0.01, fill: { color: theme.cardBorder } })
    }
    return
  }

  if (layout === L.TIMELINE) {
    if (slotIndex === 0) {
      slide.addShape('rect', { x: ROW_X + 0.2, y: rowY, w: 0.04, h: BULLET_ROW_Y[BULLET_SLOTS - 1] + BULLET_ROW_H - rowY, fill: { color: theme.accent, transparency: 40 } })
    }
    slide.addShape('ellipse', { x: ROW_X + 0.1, y: badgeY + 0.04, w: 0.24, h: 0.24, fill: { color: theme.primaryColor }, line: { color: theme.accent, width: 1 } })
    slide.addShape('roundRect', {
      x: ROW_X + 0.48, y: rowY, w: ROW_W - 0.5, h: BULLET_ROW_H, rectRadius: ROW_RADIUS,
      fill: { color: theme.contentCard }, line: { color: theme.cardBorder, width: 0.5 },
    })
    slide.addText(`CC_BULLET_${slotIndex + 1}`, {
      x: ROW_X + 0.62, y: rowY + 0.1, w: 7.6, h: 0.38, fontSize: 11, color: theme.contentBody, fontFace: FONT,
    })
    return
  }

  if (layout === L.TECH) {
    slide.addShape('rect', { x: ROW_X, y: rowY, w: ROW_W, h: BULLET_ROW_H, fill: { color: theme.contentCard }, line: { color: theme.accent, width: 0.75 } })
    slide.addShape('rect', { x: ROW_X, y: rowY, w: 0.06, h: BULLET_ROW_H, fill: { color: theme.accent } })
    slide.addText(num, { x: ROW_X + 0.12, y: rowY + 0.12, w: 0.4, h: 0.32, fontSize: 10, bold: true, color: theme.accent, fontFace: FONT })
    slide.addText(`CC_BULLET_${slotIndex + 1}`, {
      x: ROW_X + 0.55, y: rowY + 0.1, w: 8.0, h: 0.38, fontSize: 11, color: theme.contentBody, fontFace: FONT,
    })
    return
  }

  // card rows: classic, side-rail, hero, split, magazine, gala, wave
  slide.addShape('roundRect', {
    x: ROW_X, y: rowY, w: ROW_W, h: BULLET_ROW_H, rectRadius: ROW_RADIUS,
    fill: { color: theme.primaryColor, transparency: 94 }, line: { color: theme.cardBorder, width: 0.5 },
  })
  slide.addShape('rect', { x: ROW_X, y: rowY, w: 0.035, h: BULLET_ROW_H, fill: { color: theme.accent, transparency: 15 } })
  slide.addShape('roundRect', {
    x: badgeX, y: badgeY, w: BADGE_SIZE, h: BADGE_SIZE, rectRadius: BADGE_RADIUS,
    fill: { color: theme.primaryColor }, line: { width: 0 },
    shadow: { type: 'outer', blur: 4, offset: 1, angle: 90, color: '0F172A', opacity: 0.15 },
  })
  slide.addText(num, {
    x: badgeX, y: badgeY, w: BADGE_SIZE, h: BADGE_SIZE, fontSize: 9, bold: true, color: 'FFFFFF',
    align: 'center', valign: 'middle', fontFace: FONT,
  })
  slide.addText(`CC_BULLET_${slotIndex + 1}`, {
    x: ROW_X + 0.62, y: rowY + 0.1, w: 7.95, h: 0.38, fontSize: 11, color: theme.contentBody, fontFace: FONT, valign: 'top',
  })
}

function addContentHeaderClassic(slide, theme) {
  slide.addShape('rect', { x: 0.12, y: 0, w: 9.88, h: 1.05, fill: { color: theme.headerFill } })
  slide.addShape('rect', { x: 4.8, y: 0, w: 5.2, h: 1.05, fill: { color: theme.headerFillLight, transparency: 25 } })
  slide.addShape('rect', { x: 6.85, y: -0.35, w: 3.4, h: 1.35, fill: { color: 'FFFFFF', transparency: 88 }, rotate: 350 })
  slide.addShape('rect', { x: 0.12, y: 1.02, w: 9.88, h: 0.04, fill: { color: theme.accent } })
  slide.addShape('roundRect', { x: 0.52, y: 0.1, w: 1.05, h: 0.22, rectRadius: PILL_RADIUS, fill: { color: 'FFFFFF', transparency: 88 }, line: { color: 'FFFFFF', width: 0.5, transparency: 80 } })
  slide.addText('KEY POINTS', { x: 0.55, y: 0.12, w: 1.0, h: 0.18, fontSize: 7, bold: true, color: theme.contentTitle, fontFace: FONT, transparency: 25, charSpacing: 1.2 })
  slide.addText('CC_TITLE', { x: 0.55, y: 0.36, w: 8.8, h: 0.58, fontSize: 22, bold: true, color: theme.contentTitle, fontFace: FONT, valign: 'top' })
}

function addContentHeaderSideRail(slide, theme) {
  slide.addShape('rect', { x: 0, y: 0, w: 2.65, h: 5.625, fill: { color: theme.headerFill } })
  slide.addShape('rect', { x: 2.65, y: 0, w: 0.06, h: 5.625, fill: { color: theme.accent } })
  slide.addText('CC_TITLE', {
    x: 0.25, y: 0.45, w: 2.15, h: 4.5, fontSize: 18, bold: true, color: theme.contentTitle, fontFace: FONT, valign: 'top', rotate: 0,
  })
}

function addContentHeaderEditorial(slide, theme) {
  slide.addShape('rect', { x: 0.55, y: 0.42, w: 1.0, h: 0.05, fill: { color: theme.accent } })
  slide.addText('CC_TITLE', { x: 0.55, y: 0.55, w: 8.8, h: 0.55, fontSize: 24, bold: true, color: theme.primaryColor, fontFace: FONT })
}

function addContentHeaderTech(slide, theme) {
  slide.addShape('rect', { x: 0, y: 0, w: 10, h: 0.95, fill: { color: theme.headerFill } })
  slide.addShape('rect', { x: 7.2, y: 0, w: 2.8, h: 0.95, fill: { color: theme.accent, transparency: 75 } })
  slide.addShape('rect', { x: 0, y: 0.92, w: 10, h: 0.05, fill: { color: theme.accent } })
  slide.addText('// SLIDE', { x: 0.45, y: 0.12, w: 1.2, h: 0.2, fontSize: 7, bold: true, color: theme.accent, fontFace: FONT })
  slide.addText('CC_TITLE', { x: 0.45, y: 0.32, w: 8.5, h: 0.52, fontSize: 21, bold: true, color: theme.contentTitle, fontFace: FONT })
}

function addContentHeaderMagazine(slide, theme) {
  slide.addShape('rect', { x: 0, y: 0, w: 10, h: 0.18, fill: { color: theme.accent } })
  slide.addText('CC_TITLE', { x: 0.55, y: 0.28, w: 8.8, h: 0.72, fontSize: 26, bold: true, color: theme.primaryColor, fontFace: FONT })
  slide.addShape('rect', { x: 0.55, y: 1.02, w: 3.2, h: 0.04, fill: { color: theme.accent } })
}

function addContentHeaderSplit(slide, theme) {
  slide.addShape('rect', { x: 0, y: 0, w: 10, h: 1.0, fill: { color: theme.pageBg } })
  slide.addShape('roundRect', { x: 0.45, y: 0.18, w: 2.0, h: 0.65, rectRadius: 0.08, fill: { color: theme.headerFill } })
  slide.addText('CC_TITLE', { x: 0.55, y: 0.28, w: 1.85, h: 0.48, fontSize: 14, bold: true, color: theme.contentTitle, fontFace: FONT, valign: 'middle' })
  slide.addShape('rect', { x: 2.65, y: 0.48, w: 6.8, h: 0.03, fill: { color: theme.accent } })
}

function addContentFooter(slide, theme, layout) {
  if (layout === L.EDITORIAL) {
    slide.addText('CC_PAGE_NUM', { x: 9.0, y: 5.22, w: 0.75, h: 0.3, fontSize: 9, color: theme.contentBody, align: 'right', fontFace: FONT })
    return
  }
  if (layout === L.SIDE_RAIL) {
    slide.addShape('rect', { x: 2.71, y: 5.12, w: 7.29, h: 0.5, fill: { color: theme.headerFill } })
    slide.addText('CC_PAGE_NUM', { x: 9.0, y: 5.18, w: 0.68, h: 0.36, fontSize: 9, bold: true, color: theme.contentTitle, align: 'center', valign: 'middle', fontFace: FONT })
    return
  }
  slide.addShape('rect', { x: FOOTER_X, y: 5.12, w: FOOTER_W, h: 0.5, fill: { color: theme.headerFill } })
  slide.addShape('rect', { x: FOOTER_X, y: 5.12, w: FOOTER_ACCENT_W, h: 0.5, fill: { color: theme.accent, transparency: 10 } })
  slide.addShape('roundRect', { x: 8.88, y: 5.18, w: 0.68, h: 0.36, rectRadius: PILL_RADIUS, fill: { color: 'FFFFFF', transparency: 85 }, line: { color: 'FFFFFF', width: 0.5, transparency: 75 } })
  slide.addText('CC_PAGE_NUM', { x: 8.88, y: 5.18, w: 0.68, h: 0.36, fontSize: 9, bold: true, color: theme.contentTitle, align: 'center', valign: 'middle', fontFace: FONT })
}

export function addContentSlide(pptx, theme) {
  const slide = pptx.addSlide()
  const layout = layoutOf(theme)
  slide.background = { color: theme.pageBg }

  if (layout !== L.SIDE_RAIL && layout !== L.EDITORIAL) {
    addAccentBar(slide, theme)
  }
  if (layout !== L.TECH) addMeshDecorations(slide, theme)

  if (layout === L.SIDE_RAIL) {
    addContentHeaderSideRail(slide, theme)
  } else if (layout === L.EDITORIAL) {
    addContentHeaderEditorial(slide, theme)
  } else if (layout === L.TECH) {
    addContentHeaderTech(slide, theme)
  } else if (layout === L.MAGAZINE) {
    addContentHeaderMagazine(slide, theme)
  } else if (layout === L.SPLIT) {
    addContentHeaderSplit(slide, theme)
  } else {
    addContentHeaderClassic(slide, theme)
  }

  const cardX = layout === L.SIDE_RAIL ? 2.85 : CONTENT_CARD_X
  const cardW = layout === L.SIDE_RAIL ? 6.7 : CONTENT_CARD_W
  const cardY = layout === L.EDITORIAL || layout === L.MAGAZINE ? 1.28 : CONTENT_CARD_Y
  const cardH = layout === L.EDITORIAL ? 3.72 : CONTENT_CARD_H

  if (layout !== L.EDITORIAL) {
    slide.addShape('roundRect', {
      x: cardX, y: cardY, w: cardW, h: cardH, rectRadius: CARD_RADIUS,
      fill: { color: theme.contentCard }, line: { color: theme.cardBorder, width: 0.75 },
      shadow: layout === L.TECH ? undefined : { type: 'outer', blur: 14, offset: 4, angle: 90, color: theme.primaryColor, opacity: 0.1 },
    })
  }

  for (let slot = 0; slot < BULLET_SLOTS; slot += 1) {
    addBulletCardRow(slide, theme, slot, BULLET_ROW_Y[slot])
  }

  addContentFooter(slide, theme, layout)
}

export function addClosingSlide(pptx, theme) {
  const slide = pptx.addSlide()
  const layout = layoutOf(theme)
  slide.background = { color: theme.background }

  if (layout === L.GALA || layout === L.HERO) {
    slide.addShape('rect', { x: 2, y: 1.85, w: 6, h: 0.04, fill: { color: theme.accent } })
    slide.addShape('rect', { x: 2, y: 3.75, w: 6, h: 0.04, fill: { color: theme.accent } })
    slide.addText('CC_CLOSING_TITLE', { x: 0.8, y: 2.05, w: 8.4, h: 1.1, fontSize: 40, bold: true, color: theme.titleColor, align: 'center', fontFace: FONT })
    slide.addText('CC_CLOSING_SUBTITLE', { x: 0.8, y: 3.35, w: 8.4, h: 0.55, fontSize: 18, color: theme.subtitleColor, align: 'center', fontFace: FONT })
    return
  }

  if (layout === L.EDITORIAL) {
    slide.background = { color: theme.pageBg }
    slide.addText('CC_CLOSING_TITLE', { x: 0.55, y: 2.1, w: 8.8, h: 1.1, fontSize: 38, bold: true, color: theme.primaryColor, align: 'left', fontFace: FONT })
    slide.addText('CC_CLOSING_SUBTITLE', { x: 0.55, y: 3.35, w: 8.8, h: 0.55, fontSize: 16, color: theme.contentBody, align: 'left', fontFace: FONT })
    return
  }

  addAccentBar(slide, theme)
  slide.addText('CC_CLOSING_TITLE', { x: 0.55, y: 2.05, w: 8.8, h: 1.1, fontSize: 40, bold: true, color: theme.titleColor, align: 'center', fontFace: FONT })
  slide.addText('CC_CLOSING_SUBTITLE', { x: 0.55, y: 3.35, w: 8.8, h: 0.55, fontSize: 18, color: theme.subtitleColor, align: 'center', fontFace: FONT })
}

export function buildFullDeck(pptx, theme, contentSlideCount = 10) {
  addCoverSlide(pptx, theme)
  addSectionSlide(pptx, theme)
  for (let i = 0; i < contentSlideCount; i += 1) addContentSlide(pptx, theme)
  addSectionSlide(pptx, theme)
  addClosingSlide(pptx, theme)
}
