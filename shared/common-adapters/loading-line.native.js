// @flow
import Box from './box'
import React, {Component} from 'react'
import {NativeAnimated, NativeEasing} from './native-wrappers.native.js'
import {globalColors, globalStyles} from '../styles'

import type {Props} from './loading-line'

class LoadingLine extends Component<void, Props, {fadeAnim: any}> {
  state = {
    fadeAnim: new NativeAnimated.Value(0),
  }
  _animate = () => {
    NativeAnimated.timing(this.state.fadeAnim, {duration: 600, easing: NativeEasing.ease, toValue: 1, useNativeDriver: true}).start(
      () => {
        NativeAnimated.timing(this.state.fadeAnim, {duration: 600, easing: NativeEasing.ease, toValue: 0, useNativeDriver: true}).start(() => this._animate())
      })
  }
  componentDidMount () { this._animate() }
  render () {
    return (
      <Box style={{position: 'relative', height: 1}}>
        <NativeAnimated.View style={{opacity: this.state.fadeAnim}}>
          <Box style={{...globalStyles.fillAbsolute, backgroundColor: globalColors.blue, height: 1, ...this.props.style}} />
        </NativeAnimated.View>
      </Box>
    )
  }
}

export default LoadingLine
