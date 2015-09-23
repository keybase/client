'use strict'
/* @flow */

import React from 'react-native'

const {
  ActivityIndicatorIOS,
  Component,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableHighlight
} = React

import commonStyles from '../styles/common'
import Switch from '../commonAdapters/Switch'

import { submitUserPass } from '../actions/login'

class LoginForm extends Component {
  constructor (props) {
    super(props)

    this.state = {
      username: props.username || '',
      passphrase: props.passphrase || '',
      storeSecret: props.storeSecret || true
    }
  }

  submit () {
    this.props.onSubmit(this.state.username, this.state.passphrase, this.state.storeSecret)
  }

  render () {
    const error = this.props.loginError
      ? <Text style={[{margin: 20, padding: 10}, commonStyles.error]} >Error: {this.props.loginError}</Text>
      : null

    const activity = this.props.waitingForServer
      ? <View style={styles.loginWrapper}>
          <ActivityIndicatorIOS
          animating
          style={{height: 80}}
          size='large'
          />
        </View>
      : null

    const button = this.props.waitingForServer
      ? <Text style={[loginButtonStyle, {color: 'gray', backgroundColor: 'white'}]} >Login</Text>
      : <TouchableHighlight
            underlayColor={commonStyles.buttonHighlight}
            onPress={() => this.submit()}>
            <Text style={loginButtonStyle} >Login</Text>
          </TouchableHighlight>

    return (
      <View style={styles.container}>
        <TextInput
          autoCorrect={false}
          enablesReturnKeyAutomatically
          onChangeText={(username) => this.setState({username})}
          onSubmitEditing={(event) => this.refs['passphrase'].focus()}
          placeholder='Username'
          returnKeyType='next'
          style={styles.input}
          value={this.state.username}
          />

        <TextInput
          autoCorrect={false}
          enablesReturnKeyAutomatically
          onChangeText={(passphrase) => this.setState({passphrase})}
          onSubmitEditing={() => this.submit() }
          placeholder='Passphrase'
          ref='passphrase'
          returnKeyType='done'
          secureTextEntry
          style={styles.input}
          value={this.state.passphrase}
          />

        <View style={[styles.horizontal, styles.rightSide]}>
          <Text style={styles.switchText}>Remember me</Text>
          <Switch onValueChange={(value) => {}}
            value={this.state.storeSecret}
          />
        </View>

        {error}

        <View style={styles.loginWrapper}>
          {button}
        </View>

        {activity}
      </View>
    )
  }

  static parseRoute (store, route) {
    // TODO(mm): figure out how this interacts with redux's connect/bindActions
    // TODO(mm): maybe we can just pass the state here instead of the store.
    const {username, passphrase, storeSecret, waitingForServer} = store.getState().login
    const componentAtTop = {
      title: 'Login',
      component: LoginForm,
      leftButtonTitle: 'Cancel',
      mapStateToProps: state => state.login,
      props: {
        onSubmit: (username, passphrase, storeSecret) => store.dispatch(submitUserPass(username, passphrase, storeSecret)),
        username,
        passphrase,
        storeSecret,
        waitingForServer
      }
    }

    return {
      componentAtTop,
      restRoutes: [],
      parseNextRoute: null // terminal node, so no next route
    }
  }
}

LoginForm.propTypes = {
  kbNavigator: React.PropTypes.object,
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string,
  storeSecret: React.PropTypes.bool,
  loginError: React.PropTypes.string,
  onSubmit: React.PropTypes.func,
  waitingForServer: React.PropTypes.bool
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  },
  input: {
    height: 40,
    marginBottom: 5,
    marginLeft: 10,
    marginRight: 10,
    borderWidth: 0.5,
    borderColor: '#0f0f0f',
    fontSize: 13,
    padding: 4
  },
  switchText: {
    fontSize: 14,
    textAlign: 'center',
    margin: 10
  },
  horizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  rightSide: {
    justifyContent: 'flex-end',
    marginRight: 10
  },
  loginWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  }
})

const loginButtonStyle = [commonStyles.actionButton, {width: 200}]

export default LoginForm
