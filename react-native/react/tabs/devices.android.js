'use strict'
/* @flow */

import React from 'react-native'
import {
  Component,
  Text,
  View
} from 'react-native'

export default class Devices extends Component {
  render () {
    return (<View><Text>TODO: Implement</Text></View>)
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Devices',
        component: Devices,
        mapStateToProps: state => state.devices
      },
      parseNextRoute: null
    }
  }
}

Devices.propTypes = {}
