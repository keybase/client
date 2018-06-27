// @flow
import Box from './box'
import React, {Component} from 'react'
import {NativeAnimated, NativeEasing} from './native-wrappers.native'
import {globalColors, styleSheetCreate} from '../styles'

import type {Props} from './loading-line'

const animMax = 0.9

class LoadingLine extends Component<Props, {fadeAnim: any}> {
  state = {
    fadeAnim: new NativeAnimated.Value(animMax),
  }
  _animation = NativeAnimated.loop(
    NativeAnimated.sequence([
      NativeAnimated.timing(this.state.fadeAnim, {
        duration: 600,
        easing: NativeEasing.ease,
        isInteraction: false,
        toValue: 0,
        useNativeDriver: true,
      }),
      NativeAnimated.timing(this.state.fadeAnim, {
        duration: 600,
        easing: NativeEasing.ease,
        isInteraction: false,
        toValue: animMax,
        useNativeDriver: true,
      }),
    ])
  )
  componentDidMount() {
    this._animation.start()
  }

  componentWillUnmount() {
    this._animation.stop()
  }

  render() {
    return (
      <Box style={styles.container}>
        <NativeAnimated.View style={[styles.line, this.props.style, {opacity: this.state.fadeAnim}]} />
      </Box>
    )
  }
}

const styles = styleSheetCreate({
  container: {
    backgroundColor: globalColors.blue,
    height: 1,
    position: 'relative',
  },
  line: {
    backgroundColor: globalColors.white,
    height: '100%',
    width: '100%',
  },
})

export default LoadingLine
