'use strict'
/* @flow */

import React, { View, Text } from '../base-react'
import BaseComponent from '../base-component'

export default class HeaderRender extends BaseComponent {
  render () {
    return (
      <View style={{flex: 1, flexDirection: 'row'}}>
        <Text>You accessed /private/cecile</Text>
      </View>
    )
  }
}
