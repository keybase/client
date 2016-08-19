// @flow
import React from 'react'
import type {Props} from './clickable-box'
import {NativeTouchableHighlight} from './index.native'
import {globalColors} from '../styles/style-guide'

const ClickableBox = ({onClick, style, children, underlayColor, onPressIn, onPressOut}: Props) => (
  <NativeTouchableHighlight
    disabled={!onClick}
    onPress={onClick}
    onPressIn={onPressIn}
    onPressOut={onPressOut}
    style={{...boxStyle, ...style}}
    underlayColor={underlayColor || globalColors.black_10}>
    {children}
  </NativeTouchableHighlight>
)

const boxStyle = {
  borderRadius: 3,
}

export default ClickableBox
