import type * as CSS from '@/styles/css'
import type colors from '@/styles/colors'

/* eslint-disable sort-keys */
const _allTextTypes = {
  Body: 'Body',
  BodyItalic: 'BodyItalic',
  BodyBig: 'BodyBig',
  BodyBigExtrabold: 'BodyBigExtrabold',
  BodyBigLink: 'BodyBigLink',
  BodyBold: 'BodyBold',
  BodyExtrabold: 'BodyExtrabold',
  BodyPrimaryLink: 'BodyPrimaryLink',
  BodySecondaryLink: 'BodySecondaryLink',
  BodySemibold: 'BodySemibold',
  BodySemiboldLink: 'BodySemiboldLink',
  BodySemiboldItalic: 'BodySemiboldItalic',
  BodySmall: 'BodySmall',
  BodySmallBold: 'BodySmallBold',
  BodySmallExtrabold: 'BodySmallExtrabold',
  BodySmallExtraboldSecondaryLink: 'BodySmallExtraboldSecondaryLink',
  BodySmallError: 'BodySmallError',
  BodySmallItalic: 'BodySmallItalic',
  BodySmallPrimaryLink: 'BodySmallPrimaryLink',
  BodySmallSecondaryLink: 'BodySmallSecondaryLink',
  BodySmallSemibold: 'BodySmallSemibold',
  BodySmallSemiboldItalic: 'BodySmallSemiboldItalic',
  BodySmallSemiboldSecondaryLink: 'BodySmallSemiboldSecondaryLink',
  BodySmallSemiboldPrimaryLink: 'BodySmallSemiboldPrimaryLink',
  BodySmallSuccess: 'BodySmallSuccess',
  BodySmallWallet: 'BodySmallWallet',
  BodyTiny: 'BodyTiny',
  BodyTinyLink: 'BodyTinyLink',
  BodyTinySemibold: 'BodyTinySemibold',
  BodyTinySemiboldItalic: 'BodyTinySemiboldItalic',
  BodyTinyBold: 'BodyTinyBold',
  BodyTinyExtrabold: 'BodyTinyBold',
  Header: 'Header',
  HeaderItalic: 'HeaderItalic',
  HeaderExtrabold: 'HeaderExtrabold',
  HeaderBig: 'HeaderBig',
  HeaderBigExtrabold: 'HeaderBigExtrabold',
  HeaderLink: 'HeaderLink',
  Terminal: 'Terminal',
  TerminalComment: 'TerminalComment',
  TerminalEmpty: 'TerminalEmpty',
  TerminalInline: 'TerminalInline',
} as const
type AllTextTypes = typeof _allTextTypes
export type TextType = keyof AllTextTypes

export const linkTypes = new Set<TextType>([
  'BodyBigLink',
  'BodyPrimaryLink',
  'BodySecondaryLink',
  'BodySemiboldLink',
  'BodySmallPrimaryLink',
  'BodySmallSecondaryLink',
  'BodySmallSemiboldPrimaryLink',
  'BodySmallSemiboldSecondaryLink',
  'BodySmallExtraboldSecondaryLink',
  'BodyTinyLink',
  'HeaderLink',
])

export type Background =
  | 'Announcements'
  | 'Documentation'
  | 'HighRisk'
  | 'Information'
  | 'Normal'
  | 'Success'
  | 'Terminal'

type Colors = typeof colors
export type TextTypeBold = 'BodyTinyBold' | 'BodySmallBold' | 'BodyBold' | 'BodyBig' | 'Header' | 'HeaderBig'

// Talk to design before adding a color here - these should cover all cases.
type AllowedColorNames =
  | 'blueDark'
  | 'blueLighter' // for terminal background only
  | 'greenDark'
  | 'greenLight'
  | 'redDark'
  | 'purpleDark'
  | 'black'
  | 'black_on_white'
  | 'black_50'
  | 'black_50_on_white'
  | 'black_50OrWhite_40'
  | 'black_35'
  | 'black_20'
  | 'black_20_on_white'
  | 'white'
  | 'white_75'
  | 'white_40'
  | 'brown_75'
  | 'orange'
  | 'transparent'

export type AllowedColors = Colors[AllowedColorNames] | 'inherit'

export type _StylesTextCrossPlatform = CSS._CustomStyles<'color', {color?: AllowedColors}>
export type StylesTextCrossPlatform = CSS.CustomStyles<'color', {color?: AllowedColors}>

export type LineClampType = 1 | 2 | 3 | 4 | 5

export type MetaType = {
  fontSize: 12 | 13 | 14 | 15 | 18 | 24 | 16 | 17 | 20 | 28
  colorForBackground: {
    positive: string
    negative: string
  }
  isLink?: true | undefined
  styleOverride?: CSS._StylesCrossPlatform | undefined
  isTerminal?: true | undefined
}

export type TextStyle = CSS._StylesCrossPlatform & {
  fontSize?: number | undefined
  lineHeight?: number | undefined
  color?: string | undefined
  cursor?: string | undefined
}

export const backgroundModeIsNegative = (bm?: Background): boolean =>
  !!bm && !['Normal', 'Information'].includes(bm)
