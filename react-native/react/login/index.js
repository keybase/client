'use strict'
/* @flow */

const React = require('react-native')

const {
  Component,
  StyleSheet,
  View
} = React

const DevicePrompt = require('./device-prompt')
const SelectSigner = require('./select-signer')
const DisplaySecretWords = require('./display-secret-words')
const LoginForm = require('./form')

const engine = require('../engine')

const { connect } = require('react-redux/native')
const { bindActionCreators } = require('redux')
const LoginActions = require('../actions/login')

const states = require('../constants/loginStates')

class LoginContainer extends Component {
  constructor (props) {
    super(props)

    const { dispatch } = this.props
    this.actions = bindActionCreators(LoginActions, dispatch)
    // TODO move this into the router logic
    this.showingLoginState = null
  }

  componentWillUnmount () {
    // TEMP just to help debugging
    engine.reset()
    // stop login if not all the way through?
  }

  transitionPage () {
    // TODO fix this in the router. have to defer so we don't mutate navigator in render below...
    setTimeout(() => {
      this.showingLoginState = this.props.loginState

      // TODO use nice router / nav stack and not all these push/pops
      switch (this.props.loginState) {
        case states.ASK_USER_PASS:
          this.showLoginForm()
          break
        case states.ASK_DEVICE_NAME:
          this.showDevicePrompt()
          break
        case states.ASK_DEVICE_SIGNER:
          this.showDeviceSigner()
          break
        case states.SHOW_SECRET_WORDS:
          this.showSecretWords()
          break
        case states.LOGGED_IN:
          this.showLoggedIn()
          break
      }
    }, 1)
  }

  showLoginForm () {
    const { username, passphrase, storeSecret, waitingForServer } = this.props

    this.props.kbNavigator.push({
      title: 'Login',
      component: LoginForm,
      leftButtonTitle: 'Cancel',
      leftButtonPopN: 1,
      props: {
        onSubmit: (username, passphrase, storeSecret) => this.actions.submitUserPass(username, passphrase, storeSecret),
        username,
        passphrase,
        storeSecret,
        waitingForServer
      }
    })
  }

  showDevicePrompt () {
    const { deviceName, response } = this.props

    this.props.kbNavigator.push({
      title: 'Device Name',
      component: DevicePrompt,
      leftButtonTitle: 'Cancel',
      leftButtonPopN: 2,
      props: {
        onSubmit: (name) => this.actions.submitDeviceName(name, response),
        deviceName
      }
    })
  }

  showDeviceSigner () {
    const { signers, response } = this.props

    this.props.kbNavigator.push({
      title: 'Device Setup',
      leftButtonTitle: 'Cancel',
      leftButtonPopN: 3,
      component: SelectSigner,
      props: {
        onSubmit: (result) => this.actions.submitDeviceSigner(result, response),
        ...signers
      }
    })
  }

  showSecretWords () {
    const { secretWords, response } = this.props

    this.props.kbNavigator.push({
      title: 'Register Device',
      component: DisplaySecretWords,
      leftButtonTitle: 'Cancel',
      leftButtonPopN: 4,
      props: {
        onSubmit: () => this.actions.showedSecretWords(response),
        secretWords
      }
    })
  }

  showLoggedIn () {
    this.props.onLoggedIn()
  }

  render () {
    if (this.showingLoginState !== this.props.loginState) {
      this.transitionPage()
    }

    return (
      <View style={styles.container}/>
    )
  }
}

LoginContainer.propTypes = {
  kbNavigator: React.PropTypes.object.isRequired,
  onLoggedIn: React.PropTypes.func.isRequired,
  dispatch: React.PropTypes.func.isRequired,
  loginState: React.PropTypes.string.isRequired,
  loggedIn: React.PropTypes.bool.isRequired,
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string,
  storeSecret: React.PropTypes.bool.isRequired,
  deviceName: React.PropTypes.string,
  waitingForServer: React.PropTypes.bool.isRequired,
  response: React.PropTypes.object,
  signers: React.PropTypes.object,
  secretWords: React.PropTypes.string,
  error: React.PropTypes.string
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF'
  }
})

module.exports = connect(state => state.login)(LoginContainer)
