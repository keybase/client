import * as React from 'react'
import * as Styles from '@/styles'
import {metaData} from './text.meta.desktop'
import type {Props} from './text2'
import {debugWarning} from '@/util/debug-warning'

const TEMP_MARK_V2 = __DEV__ && (false as boolean)
// const TEMP_SWITCH = __DEV__ && (false as boolean)

if (TEMP_MARK_V2 /*|| TEMP_SWITCH*/) {
  debugWarning('Text2 flags on')
}

const virtualKey = 'data-virtual-text'
export const Text2 = /*TEMP_SWITCH
  ? require('./text').default
  : */ React.memo(function Text2(p: Props) {
  const {selectable, title, type = 'BodySmall', style, children: _children, lineClamp, virtualText} = p
  const meta = metaData()[type]
  const className = Styles.classNames(`text_${type}`, p.className, {
    lineClamp1: lineClamp === 1,
    lineClamp2: lineClamp === 2,
    lineClamp3: lineClamp === 3,
    lineClamp4: lineClamp === 4,
    lineClamp5: lineClamp === 5,
    selectable,
    virtualText,
    // eslint-disable-next-line sort-keys
    'hover-underline': meta.isLink,
  })

  let children = virtualText ? null : _children
  const virtTextProps = virtualText ? {[virtualKey]: _children} : undefined

  if (TEMP_MARK_V2) {
    if (children) {
      children = ['⚠', children]
    }
    if (virtTextProps) {
      virtTextProps[virtualKey] = '⚠' + virtTextProps[virtualKey]
    }
  }
  return (
    <span title={title} className={className} style={Styles.castStyleDesktop(style)} {...virtTextProps}>
      {children}
    </span>
  )
})
