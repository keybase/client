'use strict'
/* @flow */

import React from 'react-native'
import {
  Component,
  LinkingIOS,
  StyleSheet,
  Text,
  View
} from 'react-native'

import commonStyles from '../../styles/common'
import ForgotUserPass from './forgotUserPass'
import * as Constants from '../../constants/login2'

import Login from './login'
import Signup from './signup'

import { welcomeExpand, welcomeSubmitUserPass } from '../../actions/login2'

export default class Welcome extends Component {
  constructor (props) {
    super(props)

    this.state = {
      username: this.props.username || '',
      passphrase: this.props.passphrase || ''
    }
  }
  expand (section) {
    this.props.dispatch(welcomeExpand(section))
  }

  reportBug () {
    LinkingIOS.openURL('https://github.com/keybase/keybase-issues')
  }

  submitLogin (username, passphrase) {
    this.props.dispatch(welcomeSubmitUserPass(username, passphrase))
  }

  render () {
    const login = this.props.welcomeExpanded !== Constants.signupExpanded ? (
      <Login expanded={this.props.welcomeExpanded === Constants.loginExpanded}
        expand={() => this.expand(Constants.loginExpanded)}
        back={() => this.expand()}
        submitLogin={(user, passphrase) => this.submitLogin(user, passphrase)}
        />) : null

    const signup = this.props.welcomeExpanded !== Constants.loginExpanded ? (
      <Signup expanded={this.props.welcomeExpanded === Constants.signupExpanded}
        expand={() => this.expand(Constants.signupExpanded)}
        back={() => this.expand()}/>) : null

    const feedback = !this.props.welcomeExpanded ? (
      <View style={{flex: this.props.welcomeExpanded ? 0 : 1, justifyContent: 'flex-end', alignItems: 'flex-end', marginRight: 10}}>
        <Text style={commonStyles.h2} onPress={() => { this.reportBug() }}>Report a bug or problem</Text>
      </View>) : null

    return (
      <View style={[styles.container, {marginTop: 64, marginBottom: 64}]}>
        <Text style={[commonStyles.h1, {padding: 20, textAlign: 'center'}]}>Welcome to Keybase</Text>
        {login}
        {signup}
        {feedback}
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const routes = {
      forgotUserPass: ForgotUserPass.parseRoute
    }

    const componentAtTop = {
      title: '',
      component: Welcome,
      leftButtonTitle: '',
      mapStateToProps: state => state.login2
    }

    // Default the next route to the login form
    const parseNextRoute = routes[nextPath.get('path')]

    return {
      componentAtTop,
      parseNextRoute
    }
  }

}

Welcome.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  welcomeExpanded: React.PropTypes.string,
  usernames: React.PropTypes.array.isRequired,
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start'
  }
})

