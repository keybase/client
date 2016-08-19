// @flow
import Camera from 'react-native-camera'
import React, {Component} from 'react'
import type {Props} from './index'
import {NativeImage, Box} from '../../../../common-adapters'
import {globalStyles} from '../../../../styles/style-guide'

class QR extends Component<void, Props, void> {
  render () {
    if (this.props.scanning) {
      return (
        <Camera
          style={{...cameraStyle, ...this.props.style}}
          ref='cam'
          onBarCodeRead={data => this.props.onBarCodeRead(data)}>
          {this.props.children}
        </Camera>
      )
    } else {
      return (
        <Box style={{...cameraStyle, ...this.props.style}}>
          {this.props.children}
          <NativeImage style={[{width: 300, height: 300}, this.props.imageStyle]} source={{uri: this.props.qrCode}} />
        </Box>
      )
    }
  }
}

const cameraStyle = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  flex: 1,
}

export default QR
