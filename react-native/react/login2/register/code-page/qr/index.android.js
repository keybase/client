'use strict'
/* @flow */

import React, { Component, Text, View } from 'react-native'

export default class QR extends Component {
  render () {
    return (<View><Text>TODO: Implement</Text></View>)
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'QR'
      }
    }
  }
}

QR.propTypes = {}
