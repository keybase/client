import type * as React from 'react'
import type {CustomStyles, _CustomStyles, StylesCrossPlatform} from '../styles/css'
import {allTextTypes} from './text.shared'
import type * as CSS from '../styles/css'
import type colors from '../styles/colors'
import type {MeasureRef} from './measure-ref'

type Background =
  | 'Announcements'
  | 'Documentation'
  | 'HighRisk'
  | 'Information'
  | 'Normal'
  | 'Success'
  | 'Terminal'

type Values<T extends object> = T[keyof T]
type TextType = keyof typeof allTextTypes
type TextTypeBold = 'BodyTinyBold' | 'BodySmallBold' | 'BodyBold' | 'BodyBig' | 'Header' | 'HeaderBig'
// Talk to design before adding a color here - these should cover all cases.
export type AllowedColors =
  | Values<
      Pick<
        typeof colors,
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
        | 'black_35'
        | 'black_20'
        | 'black_20_on_white'
        | 'white'
        | 'white_75'
        | 'white_40'
        | 'white_40OrWhite_40'
        | 'brown_75'
        | 'orange'
        | 'transparent'
      >
    >
  | 'inherit'

export type _StylesTextCrossPlatform = _CustomStyles<'color', {color?: AllowedColors}>
export type StylesTextCrossPlatform = CustomStyles<'color', {color?: AllowedColors}>

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
  style?: StylesCrossPlatform //StylesTextCrossPlatform ideally this but its more complex than its worth now
  textBreakStrategy?: 'simple' | 'highQuality' | 'balanced' // android only,,
  title?: string
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
  styleOverride?: Object
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
  userSelect?: any
  textDecoration?: string
  colorForBackground?: string
  styleOverride?: any
  lineHeight?: any
}

declare function getStyle(
  type: TextType,
  backgroundMode?: Background,
  lineClamp?: number,
  clickable?: boolean,
  selectable?: boolean
): TextStyle

export {getStyle, allTextTypes}
export type {Background, MetaType, Props, TextType, TextTypeBold}
export default Text
