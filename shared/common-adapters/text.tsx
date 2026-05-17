import type * as React from 'react'
import * as Styles from '@/styles'
import {typeStyles, negativeColors} from './text-meta'
import {linkTypes} from './text.shared'
import type {Props} from './text.shared'
import {Text as RNText} from 'react-native'
import './text.css'

export function Text(p: Props) {
  if (!Styles.isMobile) {
    const type = p.type ?? 'BodySmall'
    const {textRef} = p
    const setRef = textRef
      ? (r: HTMLSpanElement | null) => {
          textRef.current = r as unknown as typeof textRef.current
        }
      : undefined
    const cn = Styles.classNames(`text_${type}`, p.className, {
      text_center: p.center,
      text_clickable: !!p.onClick,
      'text_hover-underline': linkTypes.has(type),
      text_lineClamp1: p.lineClamp === 1,
      text_lineClamp2: p.lineClamp === 2,
      text_lineClamp3: p.lineClamp === 3,
      text_lineClamp4: p.lineClamp === 4,
      text_lineClamp5: p.lineClamp === 5,
      text_negative: p.negative,
      text_selectable: p.selectable,
      text_underline: p.underline,
      text_underlineNever: p.underlineNever,
      text_virtualText: p.virtualText,
      tooltip: !!p.tooltip,
    })
    const lcStyle: React.CSSProperties | undefined =
      p.lineClamp && p.lineClamp > 5
        ? {
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: p.lineClamp,
            display: '-webkit-box',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            wordBreak: 'break-word',
          }
        : undefined
    const style = lcStyle
      ? {...lcStyle, ...(p.style as React.CSSProperties)}
      : p.style
        ? Styles.castStyleDesktop(p.style)
        : undefined

    return (
      <span
        ref={setRef}
        title={p.title}
        className={cn}
        onClick={p.onClick ?? undefined}
        onContextMenuCapture={p.onContextMenu ?? undefined}
        style={style}
        data-tooltip={p.tooltip}
        data-virtual-text={p.virtualText ? p.children : undefined}
      >
        {p.virtualText ? null : p.children}
      </span>
    )
  }

  const type = p.type ?? 'BodySmall'
  const baseStyle = typeStyles[type]
  const negStyle = p.negative ? {color: negativeColors[type]} : undefined
  const centerStyle = p.center ? nativeStyles.center : undefined
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

const nativeStyles = Styles.styleSheetCreate(
  () =>
    ({
      center: {textAlign: 'center'},
    }) as const
)
