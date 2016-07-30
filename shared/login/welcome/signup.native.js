 // @flow
import React, {Component} from 'react'
import {Text, View} from 'react-native'
import {connect} from 'react-redux'

// TODO redo this screen with style guide
const commonStyles = {}

class Signup extends Component {
  render () {
    return (
      <View style={{flex: 1, marginTop: 64, marginBottom: 48}}>
        <Text style={commonStyles.h1}>Sign up -</Text>
        <Text style={commonStyles.h2}>In order to sign up for our beta, a friend who is an existing member on Keybase is required to share a file with you</Text>
        <View style={{flex: 1}}>
          <Text>TODO</Text>
        </View>
      </View>
    )
  }

  static parseRoute () {
    return {}
  }
}

export default connect()(Signup)
