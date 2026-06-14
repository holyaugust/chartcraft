import type { PptCoverTheme } from '../types/pptBeautify'

export const PPT_COVER_THEMES: PptCoverTheme[] = [
  {
    id: 'green-academic',
    name: '绿野学术',
    description: '清新绿色，适合调研报告、学院汇报',
    templateFile: 'green-academic.pptx',
    preview: {
      background: 'linear-gradient(160deg, #1f6b4f 0%, #2d8a62 45%, #3da876 100%)',
      accent: '#fbbf24',
      titleColor: '#ffffff',
      subtitleColor: 'rgba(255,255,255,0.88)',
      footerColor: 'rgba(255,255,255,0.92)',
      decoration: 'radial-gradient(circle at 85% 20%, rgba(251,191,36,0.35) 0%, transparent 55%)',
      content: {
        pageBackground: 'linear-gradient(145deg, #ecfdf5 0%, #f0fdf4 40%, #dcfce7 100%)',
        headerBackground: 'linear-gradient(125deg, #14532d 0%, #1f6b4f 55%, #2d8a62 100%)',
        headerTitleColor: '#ffffff',
        bodyBackground: 'rgba(255,255,255,0.92)',
        bodyColor: '#1e293b',
        bulletAccent: '#fbbf24',
        meshDecoration:
          'radial-gradient(circle at 95% 5%, rgba(251,191,36,0.28) 0%, transparent 42%), radial-gradient(circle at 5% 95%, rgba(31,107,79,0.15) 0%, transparent 38%)',
        primaryColor: '#1f6b4f',
        cardBorder: 'rgba(31,107,79,0.12)',
      },
    },
  },
  {
    id: 'blue-business',
    name: '商务蓝',
    description: '稳重蓝色，适合工作汇报、项目总结',
    templateFile: 'blue-business.pptx',
    preview: {
      background: 'linear-gradient(160deg, #1e3a5f 0%, #2563eb 55%, #3b82f6 100%)',
      accent: '#93c5fd',
      titleColor: '#ffffff',
      subtitleColor: 'rgba(219,234,254,0.95)',
      footerColor: 'rgba(255,255,255,0.9)',
      content: {
        pageBackground: 'linear-gradient(145deg, #eff6ff 0%, #dbeafe 50%, #f0f9ff 100%)',
        headerBackground: 'linear-gradient(125deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)',
        headerTitleColor: '#ffffff',
        bodyBackground: 'rgba(255,255,255,0.94)',
        bodyColor: '#1e293b',
        bulletAccent: '#60a5fa',
        meshDecoration:
          'radial-gradient(circle at 92% 8%, rgba(96,165,250,0.3) 0%, transparent 45%), radial-gradient(circle at 8% 88%, rgba(30,58,95,0.12) 0%, transparent 40%)',
        primaryColor: '#1e3a5f',
        cardBorder: 'rgba(37,99,235,0.14)',
      },
    },
  },
  {
    id: 'dark-modern',
    name: '深色现代',
    description: '深色底 + 高对比，适合科技、产品发布',
    templateFile: 'dark-modern.pptx',
    preview: {
      background: 'linear-gradient(165deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      accent: '#38bdf8',
      titleColor: '#f8fafc',
      subtitleColor: '#94a3b8',
      footerColor: '#cbd5e1',
      content: {
        pageBackground: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
        headerBackground: 'linear-gradient(125deg, #020617 0%, #1e293b 70%, #334155 100%)',
        headerTitleColor: '#f8fafc',
        bodyBackground: 'rgba(30,41,59,0.85)',
        bodyColor: '#e2e8f0',
        bulletAccent: '#38bdf8',
        meshDecoration:
          'radial-gradient(circle at 90% 10%, rgba(56,189,248,0.22) 0%, transparent 45%), radial-gradient(circle at 10% 90%, rgba(148,163,184,0.08) 0%, transparent 40%)',
        primaryColor: '#334155',
        cardBorder: 'rgba(56,189,248,0.2)',
      },
    },
  },
  {
    id: 'red-corporate',
    name: '庄重红',
    description: '红色点缀，适合党建、正式场合',
    templateFile: 'red-corporate.pptx',
    preview: {
      background: 'linear-gradient(160deg, #7f1d1d 0%, #b91c1c 45%, #dc2626 100%)',
      accent: '#fde68a',
      titleColor: '#ffffff',
      subtitleColor: 'rgba(254,226,226,0.95)',
      footerColor: 'rgba(255,255,255,0.92)',
      content: {
        pageBackground: 'linear-gradient(145deg, #fef2f2 0%, #fee2e2 50%, #fff1f2 100%)',
        headerBackground: 'linear-gradient(125deg, #7f1d1d 0%, #b91c1c 55%, #dc2626 100%)',
        headerTitleColor: '#ffffff',
        bodyBackground: 'rgba(255,255,255,0.94)',
        bodyColor: '#1e293b',
        bulletAccent: '#fbbf24',
        meshDecoration:
          'radial-gradient(circle at 93% 7%, rgba(253,230,138,0.35) 0%, transparent 42%), radial-gradient(circle at 7% 93%, rgba(185,28,28,0.1) 0%, transparent 38%)',
        primaryColor: '#991b1b',
        cardBorder: 'rgba(185,28,28,0.14)',
      },
    },
  },
  {
    id: 'minimal-gray',
    name: '简约灰',
    description: '留白简洁，适合通用场景',
    templateFile: 'minimal-gray.pptx',
    preview: {
      background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
      accent: '#64748b',
      titleColor: '#0f172a',
      subtitleColor: '#475569',
      footerColor: '#64748b',
      content: {
        pageBackground: 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
        headerBackground: 'linear-gradient(125deg, #334155 0%, #475569 60%, #64748b 100%)',
        headerTitleColor: '#ffffff',
        bodyBackground: 'rgba(255,255,255,0.96)',
        bodyColor: '#334155',
        bulletAccent: '#64748b',
        meshDecoration:
          'radial-gradient(circle at 88% 12%, rgba(100,116,139,0.15) 0%, transparent 40%), radial-gradient(circle at 12% 88%, rgba(148,163,184,0.12) 0%, transparent 38%)',
        primaryColor: '#475569',
        cardBorder: 'rgba(100,116,139,0.16)',
      },
    },
  },
]

export function getPptCoverTheme(id: string): PptCoverTheme | undefined {
  return PPT_COVER_THEMES.find((theme) => theme.id === id)
}
