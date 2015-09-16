'use strict'
/* @flow */

var React = require('react-native')
var {
  Component,
  StyleSheet,
  View,
  Settings,
  SwitchIOS,
  Text,
  TextInput,
  TouchableHighlight
} = React

var DevicePrompt = require('./device-prompt')
var SelectSigner = require('./select-signer')
var DisplaySecretWords = require('./display-secret-words')

var engine = require('../engine')
var commonStyles = require('../styles/common')

class LoginForm extends Component {
  constructor () {
    super()

    // TODO should everything be in the keychain?
    this.state = {
      username: Settings.get('LoginFormUsername'),
      passphrase: 'okokokokokok',
      storeSecret: Settings.get('LoginFormStoreSecret')
    }
  }

  componentWillUnmount () {
    // TEMP just to help debugging
    engine.reset()
    // stop login if not all the way through?
  }

  showDevicePrompt (response) {
    this.props.kbNavigator.push({
      title: 'Device Name',
      component: DevicePrompt,
      leftButtonTitle: 'Cancel',
      leftButtonPopN: 2,
      props: {
        response: response
      }
    })
  }

  showDeviceSetup (param, response) {
    this.props.kbNavigator.push({
      title: 'Device Setup',
      leftButtonTitle: 'Cancel',
      leftButtonPopN: 3,
      component: SelectSigner,
      props: {
        response: response,
        ...param
      }
    })
  }

  showSecretWords (param, response) {
    this.props.kbNavigator.push({
      title: 'Register Device',
      component: DisplaySecretWords,
      leftButtonTitle: 'Cancel',
      leftButtonPopN: 4,
      props: {
        response: response,
        ...param
      }
    })
  }

  log (param, response) {
    console.log('LogUI: ', JSON.stringify(param, null, 2))
    response.result()
  }

  submit () {
    if (this.state.storeSecret) {
      Settings.set({LoginFormUsername: this.state.username})
    }

    const param = {
      username: this.state.username,
      passphrase: this.state.passphrase,
      storeSecret: this.state.storeSecret,
      error: null
    }

    const incomingMap = {
      'keybase.1.locksmithUi.promptDeviceName': (param, response) => { this.showDevicePrompt(response) },
      'keybase.1.locksmithUi.selectSigner': (param, response) => { this.showDeviceSetup(param, response) },
      'keybase.1.locksmithUi.displaySecretWords': (param, response) => { this.showSecretWords(param, response) },
      'keybase.1.logUi.log': (param, response) => { this.log(param, response) },
      'keybase.1.locksmithUi.kexStatus': (param, response) => { this.log(param, response) }
    }

    engine.rpc('login.loginWithPassphrase', param, incomingMap, (err, response) => {
      if (err) {
        console.log(err)
        this.setState({error: err.toString()})
      } else {
        this.props.kbNavigator.popToTop()
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
            onValueChange={(value) => {
              this.setState({storeSecret: value})
              Settings.set({LoginFormStoreSecret: value})
              Settings.set({LoginFormUsername: value ? this.state.username : ''})
            }}
            value={this.state.storeSecret}
          />
        </View>

        {error}

        <View style={styles.loginWrapper}>
          <TouchableHighlight
            underlayColor={commonStyles.buttonHighlight}
            onPress={() => { this.submit() }}>
            <Text style={loginButtonStyle} >Login</Text>
          </TouchableHighlight>
        </View>
      </View>
    )
  }
}

LoginForm.propTypes = {
  kbNavigator: React.PropTypes.object
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

module.exports = LoginForm
