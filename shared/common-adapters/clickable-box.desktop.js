// @flow
import React from 'react'
import FlatButton from 'material-ui/FlatButton'
import Box from './box'

import type {Props} from './clickable-box'

export default function ClickableBox (props: Props & {children: any}) {
  const {style, children, ...otherProps} = props
  return (
    <FlatButton {...otherProps} style={{textAlign: 'left', height: undefined, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch'}}>
      <Box style={style}>{children}</Box>
    </FlatButton>
  )
}
