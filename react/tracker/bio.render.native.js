import React, {Component, View, Text} from '../base-react'

export default class BioRender extends Component {
  render () {
    return (
      <View style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 40}}>
        <Text style={{backgroundColor: 'blue', width: 100, height: 100}}>Image</Text>
        <Text>Username</Text>
        <Text>Full Name</Text>
        <Text>Followers stuff</Text>
        <Text>location</Text>
        <Text>follows you</Text>
      </View>
    )
  }
}
