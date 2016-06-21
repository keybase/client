import React, {Component} from 'react'
import {Text, TextInput, View} from 'react-native'
import {connect} from 'react-redux'
import commonStyles from '../../styles/common'
import {login} from '../../actions/login'
import {routeAppend} from '../../actions/router'
import ForgotUserPass from './forgot-user-pass'
import Button from '../../common-adapters/button'

class Login extends Component {
  constructor (props) {
    super(props)

    this.state = {
      username: this.props.username || '',
      passphrase: this.props.passphrase || '',
    }
  }

  submitLogin () {
    this.props.login(this.state.username, this.state.passphrase)
  }

  render () {
    return (
      <View style={{flex: 1, marginTop: 64, marginBottom: 48, justifyContent: 'flex-start'}}>
        <Text style={commonStyles.h1}>Log in -</Text>
        <Text style={[commonStyles.h2, {marginBottom: 40}]}>Already a keybase user? Welcome back!</Text>
        <TextInput
          style={commonStyles.textInput}
          onChangeText={username => this.setState({username})}
          onSubmitEditing={() => this.refs.passphrase.focus()}
          value={this.state.username}
          autoCorrect={false}
          placeholder='Username'
          returnKeyType='next'
          clearButtonMode='while-editing'
        />
        <TextInput
          ref='passphrase'
          style={commonStyles.textInput}
          onChangeText={passphrase => this.setState({passphrase})}
          onSubmitEditing={() => this.submitLogin()}
          value={this.state.passphrase}
          autoCorrect={false}
          placeholder='Passphrase'
          returnKeyType='go'
          clearButtonMode='while-editing'
          secureTextEntry
        />
        <Text style={{alignSelf: 'flex-end', marginTop: 20, padding: 10}} onPress={() => this.props.showForgotUserPassPage()}>Forgot username/passphrase?</Text>
        <Button
          style={{alignSelf: 'flex-end', marginTop: 20}}
          onPress={() => { this.submitLogin() }}
          enabled={this.state.username.length && this.state.passphrase.length}
          isAction
          type='Secondary'
          title='Submit' />
      </View>
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {},
      subRoutes: {
        forgotUserPass: ForgotUserPass,
      },
    }
  }
}

Login.propTypes = {
  showForgotUserPassPage: React.PropTypes.func.isRequired,
  login: React.PropTypes.func.isRequired,
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string,
}

export default connect(
  state => {
    const {username, passphrase} = state.login
    return {username, passphrase}
  },
  dispatch => {
    return {
      showForgotUserPassPage: () => dispatch(routeAppend('forgotUserPass')),
      login: (username, passphrase) => dispatch(login(username, passphrase)),
    }
  }
)(Login)
