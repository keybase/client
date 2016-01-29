/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from '../../base-react'
import {globalStyles} from '../../styles/style-guide'
import {Text} from '../../common-adapters'

import type {IntroProps} from './intro.render'

export default class Intro extends Component {
  props: IntroProps;

  render (): ReactElement {
    return (
      <div style={styles.loginForm}>
        <Text style={styles.topMargin} type='Header'>Welcome to Keybase!</Text>
        <Text style={styles.topMargin} type='Body'>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus sagittis lacus vel augue laoreet.</Text>
        <Text style={styles.topMargin} type='Body' link onClick={this.props.onSignup}>Create Account</Text>
        <Text style={styles.topMargin} type='Body' link onClick={this.props.onLogin}>Log In</Text>
      </div>
    )
  }
}

const styles = {
  loginForm: {
    ...globalStyles.flexBoxColumn,
    flex: 1
  },

  topMargin: {
    marginTop: 20
  }
}
