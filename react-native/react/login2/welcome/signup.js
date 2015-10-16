'use strict'
/* @flow */

import React, { Component, Text, View } from 'react-native'
import commonStyles from '../../styles/common'

export default class Signup extends Component {
  constructor (props) {
    super(props)

    this.state = {}
  }

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

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        mapStateToProps: state => state.login2
      }
    }
  }
}

Signup.propTypes = { }
