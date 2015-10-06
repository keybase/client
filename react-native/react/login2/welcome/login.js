'use strict'
/* @flow */

import React from 'react-native'
import {
  Component,
  Text,
  TextInput,
  View
} from 'react-native'

import commonStyles from '../../styles/common'

export default class Login extends Component {
  constructor (props) {
    super(props)

    this.state = {
      username: this.props.username || '',
      passphrase: this.props.passphrase || ''
    }
  }

  submitLogin () {
    this.props.submitLogin(this.state.username, this.state.passphrase)
  }

  render () {
    const inputPanel = this.props.expanded ? (
      <View style={{flex: 1}}>
        <TextInput
          style={commonStyles.textInput}
          onChangeText={(username) => this.setState({username})}
          value={this.state.username}
          autoCorrect={false}
          placeholder='Username'
          returnKeyType='next'
          clearButtonMode='while-editing'
        />
        <TextInput
          style={commonStyles.textInput}
          onChangeText={(passphrase) => this.setState({passphrase})}
          onSubmitEditing={() => this.submitLogin()}
          value={this.state.passphrase}
          autoCorrect={false}
          placeholder='Passphrase'
          returnKeyType='go'
          clearButtonMode='while-editing'
          secureTextEntry
        />
        <View style={{flex: 0, alignItems: 'flex-end'}}>
          <Text style={{marginTop: 20}} onPress={() => { this.submitLogin() }}>Submit</Text>
        </View>
        <View style={{flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end'}}>
          <Text style={{marginTop: 20}} onPress={() => { this.props.back() }}>Back</Text>
        </View>
      </View>
    ) : null

    return (
      <View style={{
        flex: this.props.expanded ? 1 : 0,
        justifyContent: 'flex-start'
      }}>
        <Text style={commonStyles.h1} onPress={() => { this.props.expand() }}>Log in -</Text>
        <Text style={[commonStyles.h2, {marginBottom: 40}]}>Already a keybase user? Welcome back!</Text>
        {inputPanel}
      </View>
    )
  }
}

Login.propTypes = {
  expanded: React.PropTypes.bool.isRequired,
  back: React.PropTypes.func.isRequired,
  expand: React.PropTypes.func.isRequired,
  submitLogin: React.PropTypes.func.isRequired,
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string
}
