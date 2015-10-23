'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, TextInput, View } from 'react-native'
import Button from '../../../common-adapters/button'
import commonStyles from '../../../styles/common'
import { registerSubmitUserPass } from '../../../actions/login2'
import SetPublicName from '../set-public-name'
import { bindActionCreators } from 'redux'

export default class UserPass extends Component {
  constructor (props) {
    super(props)

    this.state = {
      username: props.username || '',
      passphrase: props.passphrase || ''
    }
  }

  onSubmit () {
    this.props.submit(this.state.username, this.state.passphrase)
  }

  render () {
    const buttonEnabled = this.state.username.length && this.state.passphrase.length
    return (
      <View style={styles.container}>
        <Text style={commonStyles.h1}>Register with your Keybase passphrase</Text>
        <Text style={commonStyles.h2}>Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsum Lorem ipsum </Text>
        <TextInput style={[commonStyles.textInput, {marginTop: 20}]}
          placeholder='Keybase Username'
          autoCorrect={false}
          enablesReturnKeyAutomatically
          onChangeText={(username) => this.setState({username})}
          onSubmitEditing={(event) => this.refs['passphrase'].focus()}
          returnKeyType='next'
          value={this.state.username}
        />
        <TextInput style={[commonStyles.textInput]}
          autoCorrect={false}
          enablesReturnKeyAutomatically
          onChangeText={(passphrase) => this.setState({passphrase})}
          onSubmitEditing={() => this.onSubmit() }
          ref='passphrase'
          returnKeyType='done'
          secureTextEntry
          value={this.state.passphrase}
          placeholder='Keybase Passphrase'
        />

        {this.props.error && (
          <Text>{this.props.error.toString()}</Text>
        )}

        <Button style={{alignSelf: 'flex-end', marginTop: 20}} buttonStyle={commonStyles.actionButton} onPress={() => this.onSubmit()} enabled={buttonEnabled} title='Submit'/>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        mapStateToProps: state => {
          const { username, passphrase, registerUserPassError: error, registerUserPassLoading: loading } = state.login2
          return {
            username,
            passphrase,
            loading,
            error
          }
        },
        props: {
          submit: bindActionCreators(registerSubmitUserPass, store.dispatch)
        }
      },
      subRoutes: {
        regSetPublicName: SetPublicName
      }
    }
  }
}

UserPass.propTypes = {
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string,
  error: React.PropTypes.object,
  loading: React.PropTypes.bool.isRequired,
  submit: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingTop: 100,
    padding: 20
  }
})

