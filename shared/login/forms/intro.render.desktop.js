/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Logo, Button} from '../../common-adapters'

import type {IntroProps} from './intro.render'

export default class Intro extends Component {
  props: IntroProps;

  render (): ReactElement {
    return (
      <div style={styles.loginForm}>
        <Logo />
        <Text style={styles.header} type='Header'>Join Keybase</Text>
        <Text style={styles.headerSub} type='Body'>Folders for anyone in the world.</Text>
        <Button style={styles.button} primary onClick={this.props.onSignup} label='Create an account' />
        <Text style={styles.loginHeader} type='Body'>Already on Keybase?</Text>
        <Text type='Body' link onClick={this.props.onLogin}>Log In</Text>
      </div>
    )
  }
}

const styles = {
  loginForm: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    marginTop: 95,
    flex: 1
  },
  header: {
    marginTop: 35
  },
  headerSub: {
    marginTop: 10
  },
  loginHeader: {
    marginTop: 95
  },
  button: {
    marginTop: 20
  }
}
