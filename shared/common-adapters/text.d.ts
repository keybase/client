import type * as React from 'react'
import type {TextType} from './text.shared'
import type * as CSS from '@/styles/css'
import type colors from '@/styles/colors'
import type {MeasureRef} from './measure-ref'

type Background =
  | 'Announcements'
  | 'Documentation'
  | 'HighRisk'
  | 'Information'
  | 'Normal'
  | 'Success'
  | 'Terminal'

type Colors = typeof colors
type TextTypeBold = 'BodyTinyBold' | 'BodySmallBold' | 'BodyBold' | 'BodyBig' | 'Header' | 'HeaderBig'
// Talk to design before adding a color here - these should cover all cases.
export type AllowedColors =
  | Colors['blueDark']
  | Colors['blueLighter'] // for terminal background only
  | Colors['greenDark']
  | Colors['greenLight']
  | Colors['redDark']
  | Colors['purpleDark']
  | Colors['black']
  | Colors['black_on_white']
  | Colors['black_50']
  | Colors['black_50_on_white']
  | Colors['black_35']
  | Colors['black_20']
  | Colors['black_20_on_white']
  | Colors['white']
  | Colors['white_75']
  | Colors['white_40']
  // | Colors['white_40OrWhite_40']
  | Colors['brown_75']
  | Colors['orange']
  | Colors['transparent']
  | 'inherit'

export type _StylesTextCrossPlatform = CSS._CustomStyles<'color', {color?: AllowedColors}>
export type StylesTextCrossPlatform = CSS.CustomStyles<'color', {color?: AllowedColors}>

export type LineClampType = 1 | 2 | 3 | 4 | 5

type Props = {
  ref?: never
  // TODO could make this ref if we make this a function component
  textRef?: React.RefObject<TextMeasureRef | MeasureRef>
  allowFontScaling?: boolean
  allowHighlightText?: boolean // if true, highlighttext through refs works,,
  center?: boolean
  children?: React.ReactNode
  className?: string
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip' // mobile only, defines how ellipsis will be put in if `lineClamp` is supplied,,
  lineClamp?: LineClampType
  negative?: boolean
  onClick?: ((e: React.BaseSyntheticEvent) => void) | null
  onClickURL?: string
  onLongPress?: () => void
  onLongPressURL?: string
  onPress?: never
  fixOverdraw?: boolean // use fastBlank to fix overdraw issues TODO support auto when this is a function
  plainText?: boolean
  selectable?: boolean
  style?: CSS.StylesCrossPlatform //StylesTextCrossPlatform ideally this but its more complex than its worth now
  textBreakStrategy?: 'simple' | 'highQuality' | 'balanced' // android only,,
  title?: string
  tooltip?: string
  type: TextType
  underline?: boolean
  underlineNever?: boolean
  virtualText?: boolean // desktop only. use css to print text thats uncopyable
}

type MetaType = {
  fontSize: number
  colorForBackground: {
    positive: string
    negative: string
  }
  isLink?: true
  styleOverride?: object
  isTerminal?: true
}

export type TextMeasureRef = {
  highlightText: () => void
} & MeasureRef

// if we fix the ref thing
// export declare const Text: ReturnType<typeof React.forwardRef<TextMeasureRef | MeasureRef, Props>>
export declare const Text: (p: Props) => React.ReactNode

type TextStyle = {
  fontSize: number
  color: string
  cursor: string
  lineClamp?: number
  clickable?: CSS._StylesDesktop
  userSelect?: string
  textDecoration?: string
  colorForBackground?: string
  styleOverride?: StylesTextCrossPlatform
  lineHeight?: number
}

declare function getStyle(
  type: TextType,
  backgroundMode?: Background,
  lineClamp?: number,
  clickable?: boolean,
  selectable?: boolean
): TextStyle

export {getStyle}
export type {Background, MetaType, Props, TextType, TextTypeBold}
export default Text
