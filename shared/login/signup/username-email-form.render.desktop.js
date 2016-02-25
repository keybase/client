/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Input, Button} from '../../common-adapters'

import type {Props} from './username-email-form.render'

export default class Render extends Component {
  props: Props;

  render () {
    let usernameRef = null
    let emailRef = null
    const submitUserEmail = () => {
      this.props.submitUserEmail(usernameRef && usernameRef.getValue(), emailRef && emailRef.getValue())
    }

    return (
      <div style={styles.form}>
        <Text style={styles.topMargin} type='Header'>Choose your Username and enter your email</Text>
        <Input ref={r => (usernameRef = r)} value={this.props.username || ''} hintText='Username' errorText={this.props.usernameErrorText}/>
        <Input ref={r => (emailRef = r)} value={this.props.email || ''} hintText='email' errorText={this.props.emailErrorText} onEnterKeyDown={submitUserEmail}/>
        <Button type='Secondary' label='Next' onClick={submitUserEmail}/>
      </div>
    )
  }
}

const styles = {
  form: {
    ...globalStyles.flexBoxColumn,
    flex: 1
  },

  topMargin: {
    marginTop: 20
  }
}
