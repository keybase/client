'use strict'

var React = require('react-native')
var {
  StyleSheet,
  Text,
  Component
} = React

// var engine = require('../engine')

var styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF'
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10
  }
})

var Form = require('./form')

class LoginStates {}
LoginStates.prototype.Form = 'Form'
LoginStates.prototype.DevicePrompt = 'DevicePrompt'
LoginStates.prototype.UserPass = 'UserPass'

class LoginComponent extends Component {
  constructor () {
    super()

    this.state = {
      screen: LoginStates.Form
    }
  }

  render () {
    return (
      <Text>Login</Text>
    )
    /*
    switch (this.state.screen) {
      case LoginStates.Form:
        return (
          <Form/>
        )
      default:
        return (
          <Text>Unknown login state</Text>
      )
    }
    */
  }
}

module.exports = LoginComponent
