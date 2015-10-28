'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import { Text, View } from 'react-native'

export default class PeopleRender extends BaseComponent {
  constructor (props) {
    super(props)
  }

  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Text> People goes here </Text>
        <Text> Count: {this.props.count} </Text>
        <Text
          onPress={this.props.onCount}
          style={{fontSize: 32, marginTop: 20, marginBottom: 20}}>
          I mean, it’s one banana, Michael. What could it cost? Ten dollars?
        </Text>
      </View>
    )
  }
}
