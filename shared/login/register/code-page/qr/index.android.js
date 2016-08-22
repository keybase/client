// @flow
import BarcodeScanner from 'react-native-barcodescanner'
import React, {Component} from 'react'
import type {Props} from './index'
import {NativeImage, Box} from '../../../../common-adapters/index.native'
import {globalStyles} from '../../../../styles/style-guide'
import {requestPermission} from 'react-native-android-permissions'

type State = {
  permissionGranted: boolean
}

class QR extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      permissionGranted: false,
    }

    requestPermission('android.permission.CAMERA').then(() => {
      this.setState({permissionGranted: true})
    }, () => {
      this.setState({permissionGranted: false})
    })
  }

  render () {
    if (this.props.scanning) {
      return (
        <BarcodeScanner
          onBarCodeRead={this.props.onBarCodeRead}
          style={this.props.style || {flex: 1}}
          torchMode={'off'}
          cameraType='back' />
      )
    } else {
      return (
        <Box style={{flex: 1, ...globalStyles.flexBoxColumn, ...this.props.style}}>
          {this.props.children}
          <NativeImage style={[{width: 300, height: 300}, this.props.imageStyle]} source={{uri: this.props.qrCode}} />
        </Box>
      )
    }
  }
}

export default QR
