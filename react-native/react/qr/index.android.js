'use strict'
/* @flow */

import React from 'react-native'
import {
  Component,
  Text,
  View
} from 'react-native'

class QR extends Component {
  render () {
    return (<View><Text>TODO: Implement</Text></View>)
  }

  static parseRoute (store, currentPath, nextPath) {
    const componentAtTop = {
      title: 'QR',
      component: QR
    }

    return {
      componentAtTop,
      parseNextRoute: null
    }
  }
}

QR.propTypes = {}

export default QR
