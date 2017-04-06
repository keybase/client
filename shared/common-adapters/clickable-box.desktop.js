// @flow
import Box from './box'
import React from 'react'
import {FlatButton} from 'material-ui'

import type {Props} from './clickable-box'

const ClickableBox = (props: Props & {children: any}) => {
  const {style, children, ...otherProps} = props

  return (
    <FlatButton {...otherProps} rippleColor={'transparent'} hoverColor={'transparent'} style={styleFlatButton}>
      <Box style={style}>{children}</Box>
    </FlatButton>
  )
}

const styleFlatButton = {
  transition: 'none',
  transform: 'none',
  textAlign: 'left',
  height: undefined,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  borderRadius: 0,
}

export default ClickableBox
