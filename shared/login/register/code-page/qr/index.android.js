import React, {Component} from 'react'
import {Text} from 'react-native'

export default class QR extends Component {
  render () {
    if (this.props.scanning) {
      return (
        <Text>TODO scanning</Text>
      )
    } else {
      return (
        <Text>TODO not scanning</Text>
      )
    }
  }

  static parseRoute () {
    return {componentAtTop: {title: 'QR'}}
  }
}

QR.propTypes = {}
