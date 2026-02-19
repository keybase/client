import * as Styles from '@/styles'
import {linkTypes} from './text.shared'
import type {Props} from './text'
import './text.css'

export function Text(p: Props) {
  const type = p.type ?? 'BodySmall'
  const {textRef} = p
  const setRef = textRef
    ? (r: HTMLSpanElement | null) => {
        textRef.current = r
          ? {divRef: {current: null}, measure: () => r.getBoundingClientRect()}
          : null
      }
    : undefined
  const cn = Styles.classNames(`t_${type}`, p.className, {
    t_center: p.center,
    t_clickable: !!p.onClick,
    't_hover-underline': linkTypes.has(type),
    t_lineClamp1: p.lineClamp === 1,
    t_lineClamp2: p.lineClamp === 2,
    t_lineClamp3: p.lineClamp === 3,
    t_lineClamp4: p.lineClamp === 4,
    t_lineClamp5: p.lineClamp === 5,
    t_negative: p.negative,
    t_selectable: p.selectable,
    t_underline: p.underline,
    t_underlineNever: p.underlineNever,
    t_virtualText: p.virtualText,
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
export default Text
