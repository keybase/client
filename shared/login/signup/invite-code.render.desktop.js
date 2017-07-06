// @flow
import Container from '../forms/container'
import React, {Component} from 'react'
import type {Props} from './invite-code.render'
import {Box, Text, Input, Button, Icon} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

type State = {
  inviteCode: string,
}

class InviteCodeRender extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      inviteCode: this.props.inviteCode || '',
    }
  }

  _onSubmit = () => {
    this.props.onInviteCodeSubmit(this.state.inviteCode)
  }

  _updateInviteCode = inviteCode => {
    this.setState({inviteCode})
  }

  render() {
    return (
      <Container onBack={this.props.onBack} style={stylesContainer}>
        <Box style={stylesBox}>
          <Text style={stylesHeader} type="Header">
            Type in your invite code:
          </Text>
          <Icon style={stylesIcon} type="icon-invite-code-48" />
          <Input
            autoFocus={true}
            style={stylesInput}
            hintText="goddess brown result reject"
            floatingHintTextOverride="Invite code"
            value={this.state.inviteCode}
            errorText={this.props.inviteCodeErrorText}
            onEnterKeyDown={this._onSubmit}
            onChangeText={this._updateInviteCode}
          />
          <Button
            style={stylesButton}
            waiting={this.props.waiting}
            type="Primary"
            label="Continue"
            onClick={this._onSubmit}
            disabled={!this.state.inviteCode}
          />
          <Text style={stylesText} type="Body">
            Not invited?
          </Text>
          <Text type="BodyPrimaryLink" onClick={this.props.onRequestInvite}>
            Request an invite code
          </Text>
        </Box>
      </Container>
    )
  }
}

const stylesButton = {
  marginTop: globalMargins.tiny,
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
  marginTop: globalMargins.large,
}
const stylesInput = {
  marginTop: globalMargins.medium,
  marginBottom: globalMargins.medium,
  width: 450,
}
const stylesText = {
  marginTop: globalMargins.large,
}

export default InviteCodeRender
