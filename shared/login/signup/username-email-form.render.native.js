/* @flow */

import React, {Component} from 'react'
import {globalColors} from '../../styles/style-guide'
import {UserCard, Input, Button} from '../../common-adapters'
import Container from '../forms/container'

import type {Props} from './username-email-form.render'

class Render extends Component {
  props: Props;

  render () {
    return (
      <Container onBack={this.props.onBack} outerStyle={stylesOuter}>
        <UserCard>
          <Input autoFocus hintText='Create a username' value={this.props.username} errorText={this.props.usernameErrorText} onChangeText={username => this.props.usernameChange(username)} />
          <Input style={stylesInput2} hintText='Email address' value={this.props.email} errorText={this.props.emailErrorText} onEnterKeyDown={this.props.onSubmit} onChangeText={email => this.props.emailChange(email)} keyboardType='email-address' />
          <Button waiting={this.props.waiting} style={{marginTop: 40}} fullWidth type='Primary' label='Continue' onClick={this.props.onSubmit} />
        </UserCard>
      </Container>
    )
  }
}

const stylesOuter = {
  backgroundColor: globalColors.black_10,
}

const stylesInput2 = {
  marginTop: 70,
}

export default Render
