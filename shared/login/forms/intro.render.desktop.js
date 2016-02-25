/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Icon, Button} from '../../common-adapters'

import type {IntroProps} from './intro.render'

export default class Intro extends Component {
  props: IntroProps;

  render () {
    return (
      <div style={styles.loginForm}>
        <Icon type='logo-128'/>
        <Text style={styles.header} type='Header'>Join Keybase</Text>
        <Text style={styles.headerSub} type='Body'>Folders for anyone in the world.</Text>
        <Button style={styles.button} type='Primary' onClick={this.props.onSignup} label='Create an account' />
        <Text style={styles.loginHeader} type='Body' link onClick={this.props.onLogin}>Already on Keybase?<br/><span>Log in</span></Text>
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
    marginTop: 95,
    textAlign: 'center'
  },
  button: {
    marginTop: 20
  }
}
