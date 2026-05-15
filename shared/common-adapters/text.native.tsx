import type * as CSS from '@/styles/css'
import type {MeasureRef} from './measure-ref'
import type {TextType} from './text.shared'
import type * as React from 'react'
import * as Styles from '@/styles'
import {typeStyles, negativeColors} from './text.meta.native'
import {Text as RNText} from 'react-native'


export type Props = {
  type?: TextType
  children?: React.ReactNode
  style?: CSS.StylesCrossPlatform
  allowFontScaling?: boolean
  onClick?: (e: React.BaseSyntheticEvent) => void
  onContextMenu?: (e: React.BaseSyntheticEvent) => void
  onLongPress?: () => void
  center?: boolean
  negative?: boolean
  lineClamp?: number
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip'
  selectable?: boolean
  title?: string
  tooltip?: string
  textRef?: React.RefObject<MeasureRef | null>
  underline?: boolean
  underlineNever?: boolean
  virtualText?: boolean
  className?: string
}
export function Text(p: Props) {
  const type = p.type ?? 'BodySmall'
  const baseStyle = typeStyles[type]
  const negStyle = p.negative ? {color: negativeColors[type]} : undefined
  const centerStyle = p.center ? styles.center : undefined
  const mergedStyle =
    negStyle || centerStyle || p.style
      ? Styles.collapseStyles([baseStyle, negStyle, centerStyle, p.style])
      : baseStyle

  return (
    <RNText
      style={mergedStyle}
      allowFontScaling={p.allowFontScaling ?? false}
      onPress={p.onClick ?? undefined}
      onLongPress={p.onLongPress ?? undefined}
      selectable={p.selectable}
      numberOfLines={p.lineClamp}
      ellipsizeMode={p.lineClamp ? (p.ellipsizeMode ?? 'tail') : undefined}
      suppressHighlighting={true}
    >
      {p.children}
    </RNText>
  )
}

export default Text

const styles = Styles.styleSheetCreate(
  () =>
    ({
      center: {textAlign: 'center'},
    }) as const
)
