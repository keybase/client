// @flow
import Camera from 'react-native-camera'
import React, {Component} from 'react'
import type {Props} from './index'
import {NativeImage, Box, Text} from '../../../../common-adapters/index.native'
import {globalStyles} from '../../../../styles'
import {throttle} from 'lodash'

class QR extends Component<void, Props, {permissionGranted: ?boolean}> {
  state = {
    permissionGranted: null,
  }

  componentDidMount() {
    this._requestCameraPermission()
  }

  async _requestCameraPermission() {
    try {
      const permissionGranted = await Camera.checkVideoAuthorizationStatus()
      this.setState({permissionGranted})
    } catch (err) {
      console.warn(err)
      this.setState({permissionGranted: false})
    }
  }

  _onBarCodeRead = throttle(data => {
    this.props.onBarCodeRead(data)
  }, 1000)

  render() {
    if (this.props.scanning) {
      if (this.state.permissionGranted) {
        return (
          <Camera
            style={{...cameraStyle, ...this.props.style}}
            captureAudio={false}
            onBarCodeRead={this._onBarCodeRead}
            barCodeTypes={[Camera.constants.BarCodeType.qr]}
          >
            {this.props.children}
          </Camera>
        )
      } else if (this.state.permissionGranted === false) {
        return (
          <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center'}}>
            <Text type="BodyError" style={{textAlign: 'center'}}>Couldn't get camera permissions.</Text>
          </Box>
        )
      } else {
        return <Text type="Body">Waiting for permissions</Text>
      }
    } else {
      return (
        <Box style={{...cameraStyle, ...this.props.style}}>
          {this.props.children}
          <NativeImage
            style={[{width: 300, height: 300}, this.props.imageStyle]}
            source={{uri: this.props.qrCode}}
          />
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
