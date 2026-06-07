export type PresentationSlideLayout = 'title' | 'section' | 'content' | 'closing' | 'chart'

export interface PresentationSlide {
  layout: PresentationSlideLayout
  title: string
  bullets?: string[]
  notes?: string
  /** chart 页：离屏渲染的 PNG data URL */
  chartImageDataUrl?: string
}

export interface PresentationOutline {
  title: string
  subtitle?: string
  slides: PresentationSlide[]
}

export interface PresentationTheme {
  primaryColor: string
  accentColor: string
  backgroundColor: string
  titleFontFace: string
  bodyFontFace: string
}

export interface PresentationTemplate {
  id: string
  name: string
  description: string
  sceneHint: string
  suggestedStructure: string
  theme: PresentationTheme
}
