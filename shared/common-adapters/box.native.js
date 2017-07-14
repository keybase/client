// @flow
import React, {Component} from 'react'
import {View as NativeView} from 'react-native'
import {colorBoxes} from '../local-debug.native'

// Has to be a class as we use refs to this sometimes apparently
class ColorView extends Component<void, any, void> {
  render() {
    return (
      <NativeView
        {...this.props}
        style={{
          ...this.props.style,
          backgroundColor: `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},1)`,
        }}
      />
    )
  }
}

const View = colorBoxes ? ColorView : NativeView

export default View
