'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import { Text, View } from 'react-native'

export default class ChatRender extends BaseComponent {
  constructor (props) {
    super(props)
  }

  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Text> Folders go here</Text>
        <Text> Whoa, whoa, whoa, whoa, theres still plenty of meat on that bone. Now you take this home, throw it in a pot, add some broth, a potato. Baby you got a stew going! </Text>
      </View>
    )
  }
}
