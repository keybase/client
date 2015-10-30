'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, TextInput, View } from 'react-native'
import Button from '../../../common-adapters/button'
import commonStyles from '../../../styles/common'

export default class UserPass extends Component {
  constructor (props) {
    super(props)

    this.state = {
      username: props.username || 'test12',
      passphrase: props.passphrase || 'okokokokokok'
    }
  }

  onSubmit () {
    this.props.onSubmit(this.state.username, this.state.passphrase)
  }

  render () {
    const buttonEnabled = this.state.username.length && this.state.passphrase.length
    return (
      <View style={styles.container}>
        <Text style={commonStyles.h1}>{this.props.title}</Text>
        <Text style={commonStyles.h2}>{this.props.subTitle}</Text>
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

  /*
  static parseRoute (store, currentPath, nextPath) {
    const title = 'Register with your Keybase passphrase'
    const subTitle = 'Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsum Lorem ipsum'

    return {
      componentAtTop: {
        component: UserPass,
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
          onSubmit: (user, passphrase) => {
            const onSubmit = currentPath.get('onSubmit')
            if (onSubmit) {
              onSubmit(user, passphrase)
            } else {
              store.dispatch(registerSubmitUserPass(user, passphrase))
            }
          },
          title,
          subTitle
        }
      },
      subRoutes: {
        regSetPublicName: SetPublicName
      }
    }
  }
  */
}

UserPass.propTypes = {
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string,
  error: React.PropTypes.object,
  onSubmit: React.PropTypes.func.isRequired,
  title: React.PropTypes.string,
  subTitle: React.PropTypes.string
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

