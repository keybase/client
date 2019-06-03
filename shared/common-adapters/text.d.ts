import * as React from 'react'
import {StylesCrossPlatform} from '../styles'
import {allTextTypes} from './text.shared'
import * as CSS from '../styles/css'

type Background =
  | 'Announcements'
  | 'Documentation'
  | 'HighRisk'
  | 'Information'
  | 'Normal'
  | 'Success'
  | 'Terminal'
type TextType = keyof typeof allTextTypes

type Props = {
  allowFontScaling?: boolean
  allowHighlightText?: boolean // if true, highlighttext through refs works,,
  center?: boolean
  children?: React.ReactNode
  className?: string
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip' // mobile only, defines how ellipsis will be put in if `lineClamp` is supplied,,
  lineClamp?: number | null
  negative?: boolean
  onClick?: ((e: React.MouseEvent<HTMLSpanElement, MouseEvent>) => void) | (() => void) | null
  onClickURL?: string | null
  onLongPress?: () => void
  onLongPressURL?: string | null
  onPress?: void
  plainText?: boolean
  selectable?: boolean
  style?: StylesCrossPlatform
  textBreakStrategy?: 'simple' | 'highQuality' | 'balanced' // android only,,
  title?: string | null
  type: TextType
  underline?: boolean
}

type MetaType = {
  fontSize: number
  colorForBackground: {
    positive: string
    negative: string
  }
  isLink?: true
  styleOverride?: Object | null
  isTerminal?: true
}

declare class Text extends React.Component<Props> {
  highlightText: () => void
}

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
  backgroundMode?: Background | null,
  lineClamp?: number | null,
  clickable?: boolean | null,
  selectable?: boolean
): TextStyle

export {getStyle, allTextTypes}
export {Background, MetaType, Props, TextType}
export default Text
