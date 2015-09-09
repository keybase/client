'use strict'

var React = require('react-native')
var {
  Component,
  StyleSheet,
  View,
  SwitchIOS,
  Text,
  TextInput,
  TouchableHighlight
} = React

var engine = require('../engine')
var DevicePrompt = require('./device-prompt')

var commonStyles = require('../styles/common')

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

class LoginForm extends Component {
  constructor () {
    super()

    this.state = {
      username: 'test7',
      passphrase: 'okokokokokok',
      storeSecret: false // TODO load this off of prefs
    }
  }

  submit () {
    engine.collatedRpc('login.loginWithPassphrase', {
      username: this.state.username,
      passphrase: this.state.passphrase,
      storeSecret: this.state.storeSecret,
      error: null
    },
    (err, method, param, response) => {
      if (err) {
        console.log(err)
        this.setState({error: err.toString()})
      } else {
        switch (method) {
          case 'keybase.1.locksmithUi.promptDeviceName':
            this.props.navigator.replace({
              title: 'Device Name',
              component: DevicePrompt,
              passProps: {
                response: response
              }
            }
          )
            break
          case null:
            break
          default:
            console.log('Unknown rpc from login.loginWithPassphrase: ', method)
        }
      }
    })
  }

  render () {

    var error = null
    if (this.state.error) {
      error = <Text style={[{margin: 20, padding: 10}, commonStyles.error]} >Error: {this.state.error}</Text>
    }

    return (
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          placeholder='Username'
          value={this.state.username}
          enablesReturnKeyAutomatically={true}
          returnKeyType='next'
          autoCorrect={false}
          onChangeText={(username) => this.setState({username})}
          onSubmitEditing={(event) => {
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
          onChangeText={(passphrase) => this.setState({passphrase})}
          onSubmitEditing={(event) => {
            this.submit()
          }}
          />

        <View style={[styles.horizontal, styles.rightSide]}>
          <Text style={styles.switchText}>Remember me</Text>
          <SwitchIOS
            onValueChange={(value) => this.setState({storeSecret: value})}
            value={this.state.storeSecret}
          />
        </View>

        {error}

        <View style={styles.loginWrapper}>
          <TouchableHighlight
            underlayColor={commonStyles.buttonHighlight}
            onPress={() => {this.submit()}}>
            <Text style={loginButtonStyle} >Login</Text>
          </TouchableHighlight>
        </View>
      </View>
    )
  }
}

LoginForm.propTypes = {
  navigator: React.PropTypes.object
}

module.exports = LoginForm
