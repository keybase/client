'use strict'

var React = require('react-native')
var {
  Component,
  StyleSheet,
  View,
  SwitchIOS,
  Text,
  TextInput
} = React

// var engine = require('../engine')

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
    justifyContent: 'flex-end',
    marginRight: 10
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
        <TextInput
          style={styles.input}
          placeholder='Username'
          value={this.state.username}
          enablesReturnKeyAutomatically={true}
          returnKeyType='next'
          autoCorrect={false}
          onSubmitEditing={(event) => {
            this.setState({username: event.nativeEvent.text})
            this.refs['passphrase'].focus()
          }}
          />
        <TextInput
          ref='passphrase'
          style={styles.input}
          placeholder='Passphrase'
          value={this.state.passphrase}
          secureTextEntry={true}
          enablesReturnKeyAutomatically={true}
          autoCorrect={false}
          returnKeyType='done'
          onSubmitEditing={(event) => {
            this.setState({passphrase: event.nativeEvent.text})
          }}
          />
          <View style={styles.horizontal}>
            <Text style={styles.switchText}>Remember me</Text>
            <SwitchIOS
              onValueChange={(value) => this.setState({storeSecret: value})}
              value={this.state.storeSecret}
            />
          </View>
      </View>
    )
  }
}

module.exports = LoginForm
