// @flow
import React, {Component} from 'react'
import {Image, View} from 'react-native'
import {globalStyles} from '../../../../styles/style-guide'

import BarcodeScanner from 'react-native-barcodescanner'

import type {Props} from './index'

export default class QR extends Component<void, Props, void> {
  render () {
    if (this.props.scanning) {
      return (
        <BarcodeScanner
          onBarCodeRead={this.props.onBarCodeRead}
          style={{flex: 1}}
          torchMode={'off'}
          cameraType='back'/>
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
