/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles, globalColors} from '../../styles/style-guide'
import {UserCard, Input, Button} from '../../common-adapters'
import Container from '../forms/container'

import type {Props} from './username-email-form.render'

class Render extends Component {
  props: Props;

  render () {
    let usernameRef = null
    let emailRef = null
    const submitUserEmail = () => {
      this.props.submitUserEmail(usernameRef && usernameRef.getValue(), emailRef && emailRef.getValue())
    }

    return (
      <Container onBack={this.props.onBack} style={stylesContainer} outerStyle={stylesOuter}>
        <UserCard style={stylesCard}>
          <Input autoFocus floatingLabelText='Create a username' value={this.props.username} ref={r => (usernameRef = r)} errorText={this.props.usernameErrorText}/>
          <Input floatingLabelText='Email address' value={this.props.email} ref={r => (emailRef = r)} errorText={this.props.emailErrorText} onEnterKeyDown={submitUserEmail}/>
          <Button style={{marginTop: 40}} fullWidth type='Primary' label='Continue' onClick={submitUserEmail}/>
        </UserCard>
      </Container>
    )
  }
}

const stylesOuter = {
  backgroundColor: globalColors.black10
}
const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 15
}
const stylesCard = {
  alignItems: 'stretch'
}

export default Render
