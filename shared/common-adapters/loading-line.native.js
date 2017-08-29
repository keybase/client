// @flow
import Box from './box'
import React, {Component} from 'react'
import {NativeAnimated, NativeEasing} from './native-wrappers.native.js'
import {globalColors, globalStyles} from '../styles'

import type {Props} from './loading-line'

class LoadingLine extends Component<Props, {fadeAnim: any}> {
  state = {
    fadeAnim: new NativeAnimated.Value(0),
  }
  _keepAnimating: boolean = false
  _animate = () => {
    if (!this._keepAnimating) {
      return
    }

    NativeAnimated.timing(this.state.fadeAnim, {
      duration: 600,
      easing: NativeEasing.ease,
      toValue: 1,
      useNativeDriver: true,
    }).start(() => {
      if (this._keepAnimating) {
        NativeAnimated.timing(this.state.fadeAnim, {
          duration: 600,
          easing: NativeEasing.ease,
          toValue: 0,
          useNativeDriver: true,
        }).start(() => this._animate())
      }
    })
  }
  componentDidMount() {
    this._keepAnimating = true
    this._animate()
  }

  componentWillUnmount() {
    this._keepAnimating = false
  }

  render() {
    return (
      <Box style={{position: 'relative', height: 1}}>
        <NativeAnimated.View
          style={{opacity: this.state.fadeAnim, position: 'absolute', left: 0, right: 0, top: 0, bottom: 0}}
        >
          <Box
            style={{
              ...globalStyles.fillAbsolute,
              backgroundColor: globalColors.blue,
              height: 1,
              ...this.props.style,
            }}
          />
        </NativeAnimated.View>
      </Box>
    )
  }
}

export default LoadingLine
