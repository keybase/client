// @flow
import Box from './box'
import React from 'react'
import {FlatButton} from 'material-ui'

import type {Props} from './clickable-box'

const ClickableBox = (props: Props & {children: any}) => {
  const {style, children, ...otherProps} = props
  return (
    <FlatButton {...otherProps} style={_buttonStyle}>
      <Box style={style}>{children}</Box>
    </FlatButton>
  )
}

const _buttonStyle = {
  textAlign: 'left',
  height: undefined,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
}

export default ClickableBox
