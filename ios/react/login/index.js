'use strict'

var React = require('react-native')
var {
  Component,
  StyleSheet,
  Text,
  View
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
LoginStates.Form = 'Form'
LoginStates.DevicePrompt = 'DevicePrompt'
LoginStates.UserPass = 'UserPass'

class LoginComponent extends Component {
  constructor () {
    super()

    this.state = {
      screen: LoginStates.Form
    }
  }

  render () {
    switch (this.state.screen) {
      case LoginStates.Form:
        return (
          <Form
            navigator={this.props.navigator}
          />
        )
      default:
        return (
          <View style={styles.container}>
            <Text style={styles.welcome}>Unknown login state</Text>
          </View>
      )
    }
  }
}

LoginComponent.propTypes = {
  navigator: React.PropTypes.object
}

module.exports = LoginComponent
