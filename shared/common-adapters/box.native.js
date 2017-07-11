// @flow
import React from 'react'
import {View as NativeView} from 'react-native'
import {colorBoxes} from '../local-debug.native'

const ColorView = (props: any) => (
  <NativeView
    {...props}
    style={{
      ...props.style,
      backgroundColor: `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},1)`,
    }}
  />
)

const View = colorBoxes ? ColorView : NativeView

export default View
