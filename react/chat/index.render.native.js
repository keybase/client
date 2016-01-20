import React, {Component, Text, View} from '../base-react'

export default class ChatRender extends Component {
  render () {
    return (
      <View style={{flex: 1, justifyContent: 'space-between', alignItems: 'stretch', padding: 0}}>
        <View style={{width: 100, height: 100, backgroundColor: 'red'}}/>
        <Text> Chat goes here </Text>
        <Text> Always Money in the Banana Stand </Text>
        <View style={{width: 100, height: 100, backgroundColor: 'blue'}}/>
      </View>
    )
  }
}
