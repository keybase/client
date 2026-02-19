import * as Styles from '@/styles'
import {linkTypes} from './text3.shared'
import type {Props} from './text3'
import './text3.css'

export function Text3(p: Props) {
  const type = p.type ?? 'BodySmall'
  const {textRef} = p
  const setRef = textRef
    ? (r: HTMLSpanElement | null) => {
        textRef.current = r
          ? {divRef: {current: null}, measure: () => r.getBoundingClientRect()}
          : null
      }
    : undefined
  const cn = Styles.classNames(`t3_${type}`, p.className, {
    t3_center: p.center,
    t3_clickable: !!p.onClick,
    't3_hover-underline': linkTypes.has(type),
    t3_lineClamp1: p.lineClamp === 1,
    t3_lineClamp2: p.lineClamp === 2,
    t3_lineClamp3: p.lineClamp === 3,
    t3_lineClamp4: p.lineClamp === 4,
    t3_lineClamp5: p.lineClamp === 5,
    t3_negative: p.negative,
    t3_selectable: p.selectable,
    t3_underline: p.underline,
    t3_virtualText: p.virtualText,
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
