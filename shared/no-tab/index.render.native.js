import React, {Component, Text, View} from '../base-react'

export default class ChatRender extends Component {
  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center', backgroundColor: 'red'}}>
        <Text> Error! Tab name was not recognized</Text>
      </View>
    )
  }
}
