// @flow
import React from 'react'
import type {Props} from './clickable-box'
import {TouchableHighlight} from 'react-native'
import {globalColors} from '../styles'

const ClickableBox = ({activeOpacity, children, onClick, onPressIn, onPressOut, style, underlayColor}: Props) => (
  <TouchableHighlight
    activeOpacity={activeOpacity || 0.2}
    disabled={!onClick}
    onPress={onClick}
    onPressIn={onPressIn}
    onPressOut={onPressOut}
    style={{...boxStyle, ...style}}
    underlayColor={underlayColor || globalColors.black_10}>
    {children}
  </TouchableHighlight>
)

const boxStyle = {
  borderRadius: 3,
}

export default ClickableBox
