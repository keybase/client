'use strict'
/* @flow */

import React, { Component, Image, StyleSheet, View } from 'react-native'
import Camera from 'react-native-camera'

export default class QR extends Component {
  render () {
    if (this.props.scanning) {
      return (
        <Camera
          style={[styles.camera, this.props.styles]}
          ref='cam'
          onBarCodeRead={(data) => this.props.onBarCodeRead(data)}>
          {this.props.children}
        </Camera>
      )
    } else {
      return (
        <View style={[styles.camera, this.props.styles]}>
          <Image style={{width: 300, height: 300}} source={{uri: this.props.qrCode}}>
            {this.props.children}
          </Image>
        </View>
      )
    }
  }
}

QR.propTypes = {
  scanning: React.PropTypes.bool.isRequired,
  onBarCodeRead: React.PropTypes.func.isRequired,
  qrCode: React.PropTypes.string,
  children: React.PropTypes.any,
  styles: React.PropTypes.any
}

const styles = StyleSheet.create({
  camera: {
    flex: 1
  }
})
