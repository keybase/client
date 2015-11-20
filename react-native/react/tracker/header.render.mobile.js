import React, {Component, View, Text} from '../base-react'

export default class HeaderRender extends Component {
  render () {
    return (
      <View style={{flex: 1, flexDirection: 'row'}}>
        <Text>You accessed /private/cecile</Text>
      </View>
    )
  }
}
