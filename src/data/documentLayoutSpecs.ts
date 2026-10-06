import {
  GBT9704_LINE_SPACING,
  GBT9704_PAGE_MARGINS,
  GBT9704_SIGNATURE_DATE_RIGHT_CHARS,
  GBT9704_SIGNATURE_ORG_RIGHT_CHARS,
  GBT9704_SIGNATURE_SPACE_BEFORE,
  GBT9704_SIZE_BODY,
  GBT9704_SIZE_HEADING1,
  GBT9704_SIZE_HEADING2,
  GBT9704_SIZE_TITLE,
} from './gbt9704ExportSpec'

export type LayoutGenre = 'official' | 'contract' | 'feasibility' | 'general'

export interface LayoutRoleStyle {
  fontEastAsia: string
  fontAscii: 'Times New Roman'
  fontFamily: string
  sizeHalfPoints: number
  bold: boolean
  align: 'left' | 'center' | 'both' | 'right'
  firstLineIndentChars: number
  rightIndentChars?: number
  spaceBefore?: number
  spaceAfter?: number
}

export interface LayoutPageSpec {
  marginTwip: {
    top: number
    right: number
    bottom: number
    left: number
    header: number
    footer: number
  }
  line: number
  lineRule: 'exact' | 'auto'
}

const ATTACHMENT_LABEL_INDENT_CHARS = 200

const STANDARD_PAGE_HEADER_FOOTER = 720

const CONTRACT_PAGE_MARGINS = {
  top: 1440,
  right: 1440,
  bottom: 1440,
  left: 1440,
  header: STANDARD_PAGE_HEADER_FOOTER,
  footer: STANDARD_PAGE_HEADER_FOOTER,
} as const

const FEASIBILITY_MARGIN_TWIP = 1417

const FEASIBILITY_PAGE_MARGINS = {
  top: FEASIBILITY_MARGIN_TWIP,
  right: FEASIBILITY_MARGIN_TWIP,
  bottom: FEASIBILITY_MARGIN_TWIP,
  left: FEASIBILITY_MARGIN_TWIP,
  header: STANDARD_PAGE_HEADER_FOOTER,
  footer: STANDARD_PAGE_HEADER_FOOTER,
} as const

const SIZE_SONG_SMALL_FOUR = 24
const SIZE_SONG_FOUR = 28

function fontFamilyForEastAsia(fontEastAsia: string): string {
  switch (fontEastAsia) {
    case '小标宋':
      return '小标宋, 华文中宋, 宋体'
    case '仿宋_GB2312':
      return '仿宋_GB2312, 仿宋, 华文仿宋'
    case '黑体':
      return '黑体, 黑体'
    case '楷体_GB2312':
      return '楷体_GB2312, 楷体'
    case '宋体':
      return '宋体, 宋体'
    default:
      return `${fontEastAsia}, 宋体`
  }
}

function roleStyle(
  fontEastAsia: string,
  sizeHalfPoints: number,
  bold: boolean,
  align: LayoutRoleStyle['align'],
  firstLineIndentChars: number,
  extras?: Pick<LayoutRoleStyle, 'rightIndentChars' | 'spaceBefore' | 'spaceAfter'>,
): LayoutRoleStyle {
  return {
    fontEastAsia,
    fontAscii: 'Times New Roman',
    fontFamily: fontFamilyForEastAsia(fontEastAsia),
    sizeHalfPoints,
    bold,
    align,
    firstLineIndentChars,
    ...extras,
  }
}

/** Values aligned with `styleForKind` in docxFormattedExport.ts */
function officialRoles(): Readonly<Record<string, LayoutRoleStyle>> {
  const bodyBase = roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, false, 'both', 200, {
    spaceBefore: 120,
    spaceAfter: 120,
  })

  return {
    skip: bodyBase,
    docKind: bodyBase,
    redHeader: roleStyle('小标宋', GBT9704_SIZE_TITLE, true, 'center', 0, { spaceAfter: 120 }),
    docNumber: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, false, 'center', 0, { spaceAfter: 160 }),
    meta: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, false, 'center', 0, { spaceAfter: 200 }),
    enterpriseBanner: roleStyle('仿宋_GB2312', 28, false, 'center', 0, { spaceAfter: 160 }),
    metaLabel: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, true, 'left', 0, { spaceAfter: 80 }),
    title: roleStyle('小标宋', GBT9704_SIZE_TITLE, true, 'center', 0, {
      spaceBefore: 200,
      spaceAfter: 280,
    }),
    recipient: roleStyle('黑体', GBT9704_SIZE_BODY, true, 'left', 0, { spaceAfter: 160 }),
    heading1: roleStyle('黑体', GBT9704_SIZE_HEADING1, true, 'left', 0, {
      spaceBefore: 320,
      spaceAfter: 120,
    }),
    heading2: roleStyle('楷体_GB2312', GBT9704_SIZE_HEADING2, true, 'left', 0, {
      spaceBefore: 300,
      spaceAfter: 120,
    }),
    heading3: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, true, 'left', 0, {
      spaceBefore: 120,
      spaceAfter: 120,
    }),
    heading4: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, false, 'left', 0, {
      spaceBefore: 120,
      spaceAfter: 120,
    }),
    numberedItem: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, false, 'both', 0, {
      spaceBefore: 120,
      spaceAfter: 120,
    }),
    closing: bodyBase,
    body: bodyBase,
    tableCaption: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, true, 'left', 0, {
      spaceBefore: 120,
      spaceAfter: 120,
    }),
    tableUnit: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, false, 'left', 0, {
      spaceBefore: 120,
      spaceAfter: 120,
    }),
    attachment: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, false, 'left', ATTACHMENT_LABEL_INDENT_CHARS, {
      spaceBefore: GBT9704_LINE_SPACING,
      spaceAfter: 0,
    }),
    attachmentItem: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, false, 'left', 0, {
      spaceBefore: 0,
      spaceAfter: 0,
    }),
    copyTo: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, false, 'both', 0, {
      spaceBefore: 120,
      spaceAfter: 120,
    }),
    signatureOrg: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, false, 'right', 0, {
      rightIndentChars: GBT9704_SIGNATURE_ORG_RIGHT_CHARS,
      spaceBefore: GBT9704_SIGNATURE_SPACE_BEFORE,
      spaceAfter: 0,
    }),
    signatureDate: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, false, 'right', 0, {
      rightIndentChars: GBT9704_SIGNATURE_DATE_RIGHT_CHARS,
      spaceAfter: 200,
    }),
    footerNote: roleStyle('仿宋_GB2312', GBT9704_SIZE_BODY, false, 'both', 200, {
      spaceBefore: 120,
      spaceAfter: 120,
    }),
  }
}

function songBodyRole(): LayoutRoleStyle {
  return roleStyle('宋体', SIZE_SONG_SMALL_FOUR, false, 'both', 200)
}

function contractRoles(): Readonly<Record<string, LayoutRoleStyle>> {
  return {
    contractTitle: roleStyle('宋体', GBT9704_SIZE_TITLE, true, 'center', 0),
    article: roleStyle('宋体', SIZE_SONG_SMALL_FOUR, true, 'left', 0),
    signature: roleStyle('宋体', SIZE_SONG_SMALL_FOUR, false, 'right', 0),
    body: songBodyRole(),
  }
}

function feasibilityRoles(): Readonly<Record<string, LayoutRoleStyle>> {
  return {
    reportTitle: roleStyle('黑体', GBT9704_SIZE_TITLE, false, 'center', 0),
    chapter: roleStyle('黑体', GBT9704_SIZE_HEADING1, false, 'left', 0),
    body: songBodyRole(),
  }
}

function generalRoles(): Readonly<Record<string, LayoutRoleStyle>> {
  return {
    heading: roleStyle('宋体', SIZE_SONG_FOUR, true, 'left', 0),
    body: songBodyRole(),
  }
}

export function getLayoutSpec(genre: LayoutGenre): {
  genre: LayoutGenre
  page: LayoutPageSpec
  roles: Readonly<Record<string, LayoutRoleStyle>>
} {
  switch (genre) {
    case 'official':
      return {
        genre,
        page: {
          marginTwip: { ...GBT9704_PAGE_MARGINS },
          line: GBT9704_LINE_SPACING,
          lineRule: 'exact',
        },
        roles: officialRoles(),
      }
    case 'contract':
      return {
        genre,
        page: {
          marginTwip: { ...CONTRACT_PAGE_MARGINS },
          line: 360,
          lineRule: 'auto',
        },
        roles: contractRoles(),
      }
    case 'feasibility':
      return {
        genre,
        page: {
          marginTwip: { ...FEASIBILITY_PAGE_MARGINS },
          line: 360,
          lineRule: 'auto',
        },
        roles: feasibilityRoles(),
      }
    case 'general':
      return {
        genre,
        page: {
          marginTwip: { ...CONTRACT_PAGE_MARGINS },
          line: 444,
          lineRule: 'auto',
        },
        roles: generalRoles(),
      }
  }
}
