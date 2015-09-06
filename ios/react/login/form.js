'use strict'

var React = require('react-native')
var {
  StyleSheet,
  Text,
  View,
  Component
} = React

var engine = require('../engine')

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

class LoginForm extends Component {
  constructor () {
    super()

    this.state = {
      username: null,
      password: null,
      storeSecret: false // TODO load this off of prefs
    }
  }

  onSubmit () {
    /*
    engine.rpc('login.loginWithPassphrase', {
      username: this.state.username,
      passphrase: this.state.passphrase,
      storeSecret: this.state.storeSecret
    },
    (err, data) => {
      console.log(err, data)
      if (!err && data) {
        this.setState({data: data})
      }
    })
      */
  }

  render () {
    return (
      <View style={styles.container}>
      <Text style={styles.welcome}>Username: {this.state.username}</Text>
      <Text style={styles.welcome}>Passphrase: {this.state.passphrase}</Text>
      <Text style={styles.welcome}>Remember me: {this.state.storeSecret}</Text>
      </View>
    )
  }
}

module.exports = LoginForm
