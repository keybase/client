import * as React from 'react'
import * as Styles from '@/styles'
import type {Props} from './text2'

export const Text2 = React.memo(function Text2(p: Props) {
  const {selectable, title, type, style, children, lineClamp} = p

  const className = Styles.classNames(`text_${type}`, p.className, {
    lineClamp1: lineClamp === 1,
    lineClamp2: lineClamp === 2,
    lineClamp3: lineClamp === 3,
    lineClamp4: lineClamp === 4,
    lineClamp5: lineClamp === 5,
    selectable,
  })
  return (
    <span title={title} className={className} style={style as any}>
      ⚠{children}
    </span>
  )
})
