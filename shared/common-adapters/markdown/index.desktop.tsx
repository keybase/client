import * as React from 'react'
import {SimpleMarkdownComponent} from './shared'
import {Props} from '.'

// We convert lint heights to px here
const DesktopSimpleMarkdownComponent = (props: Props) => {
  const {styleOverride, ...rest} = props

  const fixedStyleOverride = React.useMemo(
    () =>
      styleOverride
        ? Object.keys(styleOverride).reduce<Object>((o, k) => {
            o[k] = {
              ...styleOverride[k],
            }
            const old = styleOverride[k].lineHeight
            if (old && typeof old === 'number') {
              o[k].lineHeight = `${old}px`
            }
            return o
          }, {})
        : undefined,
    [styleOverride]
  )

  return <SimpleMarkdownComponent {...rest} styleOverride={fixedStyleOverride} />
}

export default DesktopSimpleMarkdownComponent
