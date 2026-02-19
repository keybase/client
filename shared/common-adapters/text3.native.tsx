import * as Styles from '@/styles'
import {typeStyles, negativeColors} from './text3.meta.native'
import type {Props} from './text3'
import {Text as RNText} from 'react-native'

export function Text3(p: Props) {
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
      onPress={p.onClick ?? undefined}
      onLongPress={p.onLongPress ?? undefined}
      selectable={p.selectable}
      numberOfLines={p.lineClamp}
      ellipsizeMode={p.lineClamp ? (p.ellipsizeMode ?? 'tail') : undefined}
    >
      {p.children}
    </RNText>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  center: {textAlign: 'center'},
}) as const)
