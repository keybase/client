'use strict'
/* @flow */

import React from 'react-native'
import {
  Component,
  Text,
  View
} from 'react-native'

import commonStyles from '../../styles/common'

export default class Signup extends Component {
  constructor (props) {
    super(props)

    this.state = {}
  }

  render () {
    const inputPanel = this.props.expanded ? (
      <View style={{flex: 1}}>
        <Text>TODO</Text>
        <View style={{flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end'}}>
          <Text style={{marginTop: 20}} onPress={() => { this.props.back() }}>Back</Text>
        </View>
      </View>
    ) : null

    return (
      <View style={{flex: this.props.expanded ? 1 : 0}}>
        <Text style={commonStyles.h1} onPress={() => { this.props.expand() }}>Sign up -</Text>
        <Text style={commonStyles.h2}>In order to sign up for our beta, a friend who is an existing member on Keybase is required to share a file with you</Text>
        {inputPanel}
      </View>
    )
  }
}

Signup.propTypes = {
  expanded: React.PropTypes.bool.isRequired,
  back: React.PropTypes.func.isRequired,
  expand: React.PropTypes.func.isRequired
}
