// @flow
import React from 'react'
import type {Props} from './clickable-box'
import {NativeTouchableHighlight, Box} from './index.native'
import {globalColors} from '../styles/style-guide'

const ClickableBox = ({onClick, style, children}: Props) => (
  <NativeTouchableHighlight onPress={onClick} style={{...boxStyle, ...style}} underlayColor={globalColors.black_10}>
    <Box>
      {children}
    </Box>
  </NativeTouchableHighlight>
)

const boxStyle = {
  borderRadius: 3,
}

export default ClickableBox
