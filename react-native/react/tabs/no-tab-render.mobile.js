'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import { Text, View } from 'react-native'

export default class ChatRender extends BaseComponent {
  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center', backgroundColor: 'red'}}>
        <Text> Error! Tab name was not recognized</Text>
      </View>
    )
  }
}
