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

class LoginScreen extends Component {
  constructor () {
    super()

    this.state = {
      username: null,
      password: null,
      storeSecret: false // TODO load this off of prefs
    }
  }

  onSubmit () {
    var toSend = this.state.data

    engine.rpc('login.loginWithPassphrase', {
      username: this.state.username,
      passphrase: this.state.passphrase,
      storeSecret: this.state.storeSecret
    },
    (err, data) => {
      if (!err && data) {
        this.setState({data: data})
      }
    })
  }

  render () {
    return (
      <View style={styles.container}>
      <Text style={styles.welcome}>From Go: {this.state.data}</Text>
      </View>
    )
  }
}

module.exports = GoTest
