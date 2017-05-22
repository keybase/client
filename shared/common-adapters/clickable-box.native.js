// @flow
import React from 'react'
import type {Props} from './clickable-box'
import Box from './box'
import {TouchableOpacity, TouchableWithoutFeedback} from 'react-native'
import {globalColors} from '../styles'
import {clickableVisible} from '../local-debug'

const ClickableBox = ({
  onClick,
  onLongPress,
  style,
  children,
  underlayColor,
  onPressIn,
  onPressOut,
  feedback = true,
}: Props) => {
  if (onClick) {
    if (feedback) {
      return (
        <TouchableOpacity
          disabled={!onClick}
          onPress={onClick}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onLongPress={onLongPress}
          style={{...boxStyle, ...(clickableVisible ? visibleStyle : {}), ...style}}
          underlayColor={underlayColor || globalColors.white}
          activeOpacity={0.7}
        >
          {children}
        </TouchableOpacity>
      )
    } else {
      return (
        <TouchableWithoutFeedback
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={{...boxStyle, ...(clickableVisible ? visibleStyle : {}), ...style}}
          onPress={onClick}
          onLongPress={onLongPress}
        >
          {children}
        </TouchableWithoutFeedback>
      )
    }
  } else {
    return (
      <Box style={{...boxStyle, ...style}}>
        {children}
      </Box>
    )
  }
}

const boxStyle = {
  borderRadius: 3,
}

const visibleStyle = {
  backgroundColor: 'rgba(0, 255, 0, 0.1)',
}

export default ClickableBox
