// @flow
import logger from '../../../../logger'
import Camera from 'react-native-camera'
import {PermissionsAndroid} from 'react-native'
import React, {Component} from 'react'
import type {Props} from './index'
import {NativeImage, Box, Text} from '../../../../common-adapters/index.native'
import {globalStyles} from '../../../../styles'
import {throttle} from 'lodash-es'

type PermissionStatus = 'granted' | 'denied' | 'never_ask_again'

class QR extends Component<Props, {permissionGranted: ?boolean}> {
  state = {
    permissionGranted: null,
  }

  componentDidMount() {
    this._requestCameraPermission()
  }

  async _requestCameraPermission() {
    try {
      const status: PermissionStatus = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Keybase Camera Permission',
          message: 'Keybase needs access to your camera so we can scan your codes',
        }
      )

      this.setState({permissionGranted: status === 'granted'})
    } catch (err) {
      logger.warn(err)
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
            ref="cam"
            onBarCodeRead={this._onBarCodeRead}
          >
            {this.props.children}
          </Camera>
        )
      } else {
        if (this.state.permissionGranted === false) {
          return (
            <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center'}}>
              <Text type="BodyError" style={{textAlign: 'center'}}>
                Couldn't get camera permissions.
              </Text>
            </Box>
          )
        } else {
          return <Text type="Body">Waiting for permissions</Text>
        }
      }
    } else {
      return (
        <Box style={{flex: 1, ...globalStyles.flexBoxColumn, ...this.props.style}}>
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
