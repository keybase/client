/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles, globalColors} from '../../styles/style-guide'
import {UserCard, Input, Button} from '../../common-adapters'
import Container from '../forms/container'

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
      <Container onBack={this.props.onBack} style={styles.container} outerStyle={styles.outer}>
        <UserCard style={styles.card}>
          <Input style={styles.first} floatingLabelText='Create a username' value={this.props.username} ref={r => (usernameRef = r)} errorText={this.props.usernameErrorText}/>
          <Input floatingLabelText='Email address' value={this.props.email} ref={r => (emailRef = r)} errorText={this.props.emailErrorText}/>
          <Button fullWidth type='Primary' label='Continue' onClick={submitUserEmail}/>
        </UserCard>
      </Container>
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
  },
  outer: {
    backgroundColor: globalColors.black10
  },
  container: {
    ...globalStyles.flexBoxColumn,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15
  },
  card: {
    paddingLeft: 30,
    paddingRight: 30
  },
  first: {
    marginTop: 35
  }
}
