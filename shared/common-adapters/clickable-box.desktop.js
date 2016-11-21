// @flow
import Box from './box'
import FlatButton from 'material-ui'
import React from 'react'
import type {Props} from './clickable-box'

export default function ClickableBox (props: Props & {children: any}) {
  const {style, children, ...otherProps} = props
  return (
    <FlatButton {...otherProps} style={{textAlign: 'left', height: undefined, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch'}}>
      <Box style={style}>{children}</Box>
    </FlatButton>
  )
}
