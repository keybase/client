// @flow
import * as React from 'react'
import type {Props} from './clickable-box'
import Box from './box'
import {TouchableOpacity, TouchableWithoutFeedback} from 'react-native'
import {globalColors} from '../styles'

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
    const clickStyle = style ? {...boxStyle, ...style} : boxStyle
    if (feedback) {
      return (
        <TouchableOpacity
          disabled={!onClick}
          onPress={onClick}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onLongPress={onLongPress}
          style={clickStyle}
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
          style={clickStyle}
          onPress={onClick}
          onLongPress={onLongPress}
        >
          {children}
        </TouchableWithoutFeedback>
      )
    }
  } else {
    return (
      <Box style={style}>
        {children}
      </Box>
    )
  }
}

const boxStyle = {
  borderRadius: 3,
}

export default ClickableBox
