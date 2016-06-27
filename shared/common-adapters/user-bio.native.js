import React, {Component} from 'react'
import {View, Text} from 'react-native'
import {Avatar} from './'

export default class BioRender extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Avatar size={this.props.avatarSize} />
        <Text>Username</Text>
        <Text>Full Name</Text>
        <Text>Followers stuff</Text>
        <Text>location</Text>
        <Text>follows you</Text>
      </View>
    )
  }
}

const styles = {
  container: {
    flexDirection: 'column',
    alignItems: 'center',
  },
}
