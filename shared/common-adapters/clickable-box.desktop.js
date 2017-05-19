// @flow
import React from 'react'
import {FlatButton} from 'material-ui'

import type {Props} from './clickable-box'

const ClickableBox = (props: Props & {children: any}) => {
  const {style, children, ...otherProps} = props

  // FlatButton on desktop doesn't support onLongPress, but we allow the common
  // ClickableBox component to pass one down for mobile, so strip it out here.
  if (otherProps.onLongPress) {
    delete otherProps.onLongPress
  }

  return (
    <FlatButton
      {...otherProps}
      disableTouchRipple={true}
      rippleColor={'transparent'}
      hoverColor={'transparent'}
      style={{...styleFlatButton, ...style}}
    >
      {children}
    </FlatButton>
  )
}

const styleFlatButton = {
  transition: 'none',
  transform: 'none',
  textAlign: 'left',
  height: undefined,
  minWidth: undefined,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  borderRadius: 0,
  lineHeight: 0,
}

export default ClickableBox
