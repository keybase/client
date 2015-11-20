import React, {Component, Image, StyleSheet, View} from '../../../../base-react'
import Camera from 'react-native-camera'

export default class QR extends Component {
  render () {
    if (this.props.scanning) {
      return (
        <Camera
          style={[styles.camera, this.props.style]}
          ref='cam'
          onBarCodeRead={data => this.props.onBarCodeRead(data)}>
          {this.props.children}
        </Camera>
      )
    } else {
      return (
        <View style={[styles.camera, this.props.style]}>
          {this.props.children}
          <Image style={[{width: 300, height: 300}, this.props.imageStyle]} source={{uri: this.props.qrCode}} />
        </View>
      )
    }
  }
}

QR.propTypes = {
  scanning: React.PropTypes.bool,
  onBarCodeRead: React.PropTypes.func,
  qrCode: React.PropTypes.string,
  children: React.PropTypes.any,
  style: React.PropTypes.any,
  imageStyle: React.PropTypes.any
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
    flexDirection: 'column'
  }
})
