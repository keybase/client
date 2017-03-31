// @flow
import React from 'react'
import type {Props} from './clickable-box'
import {TouchableHighlight, TouchableWithoutFeedback, View} from 'react-native'
import {globalColors} from '../styles'

const ClickableBox = ({onClick, style, children, underlayColor, onPressIn, onPressOut, feedback = true}: Props) => {
  if (onClick) {
    if (feedback) {
      return <TouchableHighlight
        disabled={!onClick}
        onPress={onClick}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{...boxStyle, ...style}}
        underlayColor={underlayColor || globalColors.black_10}>
        {children}
      </TouchableHighlight>
    } else {
      return <TouchableWithoutFeedback
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{...boxStyle, ...style}}
        onPress={onClick}>
        {children}
      </TouchableWithoutFeedback>
    }
  } else {
    return <View style={{...boxStyle, ...style}}>
      {children}
    </View>
  }
}

const boxStyle = {
  borderRadius: 3,
}

export default ClickableBox
