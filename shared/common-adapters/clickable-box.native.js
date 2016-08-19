// @flow
import React from 'react'
import type {Props} from './clickable-box'
import {TouchableHighlight} from 'react-native'
import {globalColors} from '../styles'

const ClickableBox = ({onClick, style, children, underlayColor, onPressIn, onPressOut}: Props) => (
  <TouchableHighlight
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
