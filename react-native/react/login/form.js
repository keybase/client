'use strict'
/* @flow */

import React from 'react-native'

const {
  ActivityIndicatorIOS,
  Component,
  StyleSheet,
  View,
  SwitchIOS,
  Text,
  TextInput,
  TouchableHighlight
} = React

const commonStyles = require('../styles/common')

class LoginForm extends Component {
  constructor (props) {
    super(props)

    this.state = {
      username: props.username || '',
      passphrase: props.passphrase || '',
      storeSecret: props.storeSecret || ''
    }
  }

  submit () {
    this.props.onSubmit(this.state.username, this.state.passphrase)
  }

  render () {
    var error = null
    if (this.props.loginError) {
      error = <Text style={[{margin: 20, padding: 10}, commonStyles.error]} >Error: {this.props.loginError}</Text>
    }

    var activity = null
    if (this.props.waitingForServer) {
      activity = <View style={styles.loginWrapper}>
        <ActivityIndicatorIOS
        animating={true}
        style={{height: 80}}
        size='large'
        />
      </View>
    }

    var button = this.props.waitingForServer ? <Text style={[loginButtonStyle, {color: 'gray', backgroundColor: 'white'}]} >Login</Text>
      : <TouchableHighlight
            underlayColor={commonStyles.buttonHighlight}
            onPress={() => this.submit()}>
            <Text style={loginButtonStyle} >Login</Text>
          </TouchableHighlight>

    return (
      <View style={styles.container}>
        <TextInput
          autoCorrect={false}
          enablesReturnKeyAutomatically={true}
          onChangeText={(username) => this.setState({username})}
          onSubmitEditing={(event) => this.refs['passphrase'].focus()}
          placeholder='Username'
          returnKeyType='next'
          style={styles.input}
          value={this.state.username}
          />

        <TextInput
          autoCorrect={false}
          enablesReturnKeyAutomatically={true}
          onChangeText={(passphrase) => this.setState({passphrase})}
          onSubmitEditing={() => this.submit() }
          placeholder='Passphrase'
          ref='passphrase'
          returnKeyType='done'
          secureTextEntry={true}
          style={styles.input}
          value={this.state.passphrase}
          />

        <View style={[styles.horizontal, styles.rightSide]}>
          <Text style={styles.switchText}>Remember me</Text>
          <SwitchIOS
            onValueChange={(value) => {
            }}
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

var styles = StyleSheet.create({
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

var loginButtonStyle = [commonStyles.actionButton, {width: 200}]

export default LoginForm
