/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalColors, globalStyles} from '../../styles/style-guide'
import {Text, Icon, Button} from '../../common-adapters'

import type {IntroProps} from './intro.render'

export default class Intro extends Component {
  props: IntroProps;

  render () {
    return (
      <div style={styles.loginForm}>
        <Icon type='logo-160'/>
        <Text style={styles.header} type='HeaderJumbo'>Join Keybase</Text>
        <Text style={styles.headerSub} type='Body'>Folders for anyone in the world.</Text>
        <Button style={styles.button} type='Primary' onClick={this.props.onSignup} label='Create an account' />
        <Text style={styles.loginHeader} type='Body' onClick={this.props.onLogin}>Already on Keybase?</Text>
        <Text type='BodyPrimaryLink' onClick={this.props.onLogin}>Log in</Text>
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
    marginTop: 27,
    color: globalColors.orange
  },
  headerSub: {
    marginTop: 3
  },
  loginHeader: {
    marginTop: 91,
    textAlign: 'center'
  },
  button: {
    marginTop: 15
  }
}
