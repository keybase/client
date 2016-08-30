// @flow
import Camera from 'react-native-camera'
import React, {Component} from 'react'
import type {Props} from './index'
import {Image, View} from 'react-native'
import {globalStyles} from '../../../../styles'

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
        <View style={{...cameraStyle, ...this.props.style}}>
          {this.props.children}
          <Image style={[{width: 300, height: 300}, this.props.imageStyle]} source={{uri: this.props.qrCode}} />
        </View>
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
