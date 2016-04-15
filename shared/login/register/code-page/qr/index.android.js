import React, {Component} from 'react'
import {Image, Text, View} from 'react-native'

export default class QR extends Component {
  render () {
    if (this.props.scanning) {
      return (
        <Text>TODO</Text>
      )
    } else {
      return (
        <Text>TODO</Text>
      )
    }
  }

  static parseRoute () {
    return {componentAtTop: {title: 'QR'}}
  }
}

QR.propTypes = {}
