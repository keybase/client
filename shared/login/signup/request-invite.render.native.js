/* @flow */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Icon, Input, Button, Box} from '../../common-adapters'
import Container from '../forms/container'

import type {Props} from './request-invite.render'

export default class Render extends Component {
  props: Props;

  render () {
    return (
      <Container onBack={this.props.onBack} style={stylesContainer}>
        <Text style={stylesHeader} type='Header'>Request an invite code</Text>
        <Icon style={stylesIcon} type='invite-code-m' />
        <Input
          hintText='Your email address'
          value={this.props.email}
          errorText={this.props.emailErrorText}
          onChangeText={email => this.props.emailChange(email)}
          autoFocus />
        <Input
          hintText='Your name'
          value={this.props.name}
          errorText={this.props.nameErrorText}
          onChangeText={name => this.props.nameChange(name)} />
        <Button
          fullWidth
          style={stylesButton}
          waiting={this.props.waiting}
          type='Primary'
          label='Request'
          onClick={this.props.onSubmit}
          disabled={!this.props.email} />
        <Box style={{flex: 1}} />
      </Container>
    )
  }
}

const stylesButton = {
  marginTop: 50,
}
const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-start',
  alignItems: 'stretch',
}
const stylesHeader = {
  marginTop: 30,
  alignSelf: 'center',
}
const stylesIcon = {
  marginTop: 40,
  alignSelf: 'center',
}
