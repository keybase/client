// @flow
import React, {Component} from 'react'
import {Image, View} from 'react-native'
import {globalStyles} from '../../../../styles/style-guide'

import BarcodeScanner from 'react-native-barcodescanner'
import {requestPermission} from 'react-native-android-permissions'

import type {Props} from './index'

type State = {
  permissionGranted: boolean
}

export default class QR extends Component<void, Props, State> {
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
        <View style={{flex: 1, ...globalStyles.flexBoxColumn, ...this.props.style}}>
          {this.props.children}
          <Image style={[{width: 300, height: 300}, this.props.imageStyle]} source={{uri: this.props.qrCode}} />
        </View>
      )
    }
  }
}
