// @flow
import Container from '../forms/container'
import React, {Component} from 'react'
import type {Props} from './request-invite.render'
import {Text, Icon, Input, Button, Box} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'

class RequestInviteRender extends Component {
  props: Props

  render() {
    return (
      <Container onBack={this.props.onBack} style={stylesContainer}>
        <Text style={stylesHeader} type="Header">
          Request an invite code
        </Text>
        <Icon style={stylesIcon} type="icon-invite-code-48" />
        <Input
          hintText="Your email address"
          floatingHintTextOverride="Your email address"
          value={this.props.email}
          errorText={this.props.emailErrorText}
          onChangeText={email => this.props.emailChange(email)}
          autoFocus={true}
        />
        <Input
          hintText="Your name"
          floatingHintTextOverride="Your name"
          value={this.props.name}
          errorText={this.props.nameErrorText}
          onChangeText={name => this.props.nameChange(name)}
        />
        <Button
          fullWidth={true}
          style={stylesButton}
          waiting={this.props.waiting}
          type="Primary"
          label="Request"
          onClick={this.props.onSubmit}
          disabled={!this.props.email}
        />
        <Box style={{flex: 1}} />
      </Container>
    )
  }
}

const stylesButton = {
  marginTop: globalMargins.medium,
}
const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-start',
  alignItems: 'stretch',
}
const stylesHeader = {
  marginTop: globalMargins.small,
  alignSelf: 'center',
}
const stylesIcon = {
  marginTop: globalMargins.small,
  alignSelf: 'center',
}

export default RequestInviteRender
