/* @flow */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Icon, Input, Button} from '../../common-adapters'
import Container from '../forms/container'

import type {Props} from './request-invite.render'

class Render extends Component<void, Props, void> {
  render () {
    return (
      <Container onBack={this.props.onBack} style={stylesContainer}>
        <Text style={stylesHeader} type='Header'>Request an invite code</Text>
        <Icon style={stylesIcon} type='invite-code-m' />
        <Input
          style={stylesInput}
          floatingLabelText='Your email address'
          value={this.props.email}
          errorText={this.props.emailErrorText}
          onChangeText={email => this.props.emailChange(email)}
          autoFocus />
        <Input
          style={stylesInput}
          floatingLabelText='Your name'
          value={this.props.name}
          errorText={this.props.nameErrorText}
          onChangeText={name => this.props.nameChange(name)} />
        <Button
          style={stylesButton}
          waiting={this.props.waiting}
          type='Primary'
          label='Request'
          onClick={this.props.onSubmit}
          disabled={!this.props.email} />
      </Container>
    )
  }
}

const stylesButton = {
  marginTop: 50,
  marginBottom: 30,
  marginRight: 0,
  alignSelf: 'flex-end',
}
const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}
const stylesHeader = {
  marginTop: 30,
}
const stylesIcon = {
  marginTop: 55,
}
const stylesInput = {
  height: 45,
  marginTop: 25,
  width: 450,
}

export default Render
