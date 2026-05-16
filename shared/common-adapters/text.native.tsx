import type * as React from 'react'
import * as Styles from '@/styles'
import {typeStyles, negativeColors} from '@/common-adapters/text.meta.native'
import {Text as RNText} from 'react-native'
import type {Props} from '@/common-adapters/text.shared'


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
