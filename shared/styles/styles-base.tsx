import * as React from 'react'

type _Elem = object | null | false
// CollapsibleStyle is a generic version of ?StylesMobile and family,
// slightly extended to support "isFoo && myStyle".
export type CollapsibleStyle = _Elem | ReadonlyArray<_Elem>

export const collapseStyles = (styles: ReadonlyArray<CollapsibleStyle>): object | undefined => {
  // fast path for a single style that passes. Often we do stuff like
  // collapseStyle([styles.myStyle, this.props.something && {backgroundColor: 'red'}]), so in the false
  // case we can just take styles.myStyle and not render thrash
  const valid = styles.filter(s => {
    return !!s && Object.keys(s).length
  })
  if (valid.length === 0) {
    return undefined
  }
  if (valid.length === 1) {
    const s = valid[0]
    if (typeof s === 'object') {
      return s as object
    }
  }

  // jenkins doesn't support flat yet
  const s = Object.assign({}, ...styles.flat()) as object
  return Object.keys(s).length ? s : undefined
}

export const collapseStylesDesktop = collapseStyles

export const urlEscapeFilePath = (path: string) => {
  if (path.startsWith('file://')) {
    const parts = path.split('/')
    parts[parts.length - 1] = encodeURIComponent(parts[parts.length - 1]!)
    return parts.join('/')
  }
  return path
}

export const castStyleDesktop = (style: CollapsibleStyle) => style
export const castStyleNative = (style: CollapsibleStyle) => style

export const CanFixOverdrawContext = React.createContext(false)
export const dontFixOverdraw = {canFixOverdraw: false}
export const yesFixOverdraw = {canFixOverdraw: true}

