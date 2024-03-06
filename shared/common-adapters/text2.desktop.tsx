import * as React from 'react'
import * as Styles from '@/styles'
import type {Props} from './text2'

export const Text2 = React.memo(function Text2(p: Props) {
  const {title, type, style, children} = p

  const className = Styles.classNames(`text_${type}`, p.className)
  return (
    <span title={title} className={className} style={style as any}>
      {children}
    </span>
  )
})
