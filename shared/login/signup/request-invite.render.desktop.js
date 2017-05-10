// @flow
import Container from '../forms/container'
import React, {Component} from 'react'
import type {Props} from './request-invite.render'
import {Box, Text, Icon, Input, Button} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

class RequestInviteRender extends Component<void, Props, void> {
  render() {
    return (
      <Container onBack={this.props.onBack} style={stylesContainer}>
        <Box style={stylesBox}>
          <Text style={stylesHeader} type="Header">
            Request an invite code
          </Text>
          <Icon style={stylesIcon} type="icon-invite-code-48" />
          <Input
            style={stylesInput}
            hintText="Your email address"
            value={this.props.email}
            errorText={this.props.emailErrorText}
            onChangeText={email => this.props.emailChange(email)}
            autoFocus={true}
          />
          <Input
            style={stylesInput}
            hintText="Your name"
            value={this.props.name}
            errorText={this.props.nameErrorText}
            onChangeText={name => this.props.nameChange(name)}
          />
          <Button
            style={stylesButton}
            waiting={this.props.waiting}
            type="Primary"
            label="Request"
            onClick={this.props.onSubmit}
            disabled={!this.props.email}
          />
        </Box>
      </Container>
    )
  }
}

const stylesButton = {
  marginTop: 50,
  marginBottom: 30,
  marginRight: 0,
  alignSelf: 'center',
}
const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
}
const stylesBox = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  width: 580,
}

const stylesHeader = {
  marginTop: globalMargins.medium,
}
const stylesIcon = {
  marginTop: 55 - 11,
  marginBottom: -11,
}
const stylesInput = {
  height: 45,
  marginTop: 25,
  width: 450,
}

export default RequestInviteRender
