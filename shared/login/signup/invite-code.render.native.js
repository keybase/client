// @flow
import Container from '../forms/container'
import React, {Component} from 'react'
import type {Props} from './invite-code.render'
import {Text, Input, Button, Icon, Box} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'

type State = {
  inviteCode: string,
}

class InviteCodeRender extends Component<void, Props, State> {
  state: State

  constructor (props: Props) {
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

  render () {
    return (
      <Container onBack={this.props.onBack} style={stylesContainer}>
        <Text style={stylesHeader} type='Header'>Type in your invite code:</Text>
        <Icon style={stylesIcon} type='icon-invite-code-48' />
        <Input autoFocus={true} style={stylesInput} value={this.state.inviteCode} errorText={this.props.inviteCodeErrorText} onEnterKeyDown={this._onSubmit} onChangeText={this._updateInviteCode} />
        <Button style={stylesButton} waiting={this.props.waiting} type='Primary' label='Continue' onClick={this._onSubmit} disabled={!this.state.inviteCode} />
        <Text type='BodySmall'>Not invited?</Text>
        <Text type='BodySmallSecondaryLink' onClick={this.props.onRequestInvite}>Request an invite</Text>
        <Box style={{flex: 1}} />
      </Container>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}
const stylesHeader = {
  marginTop: globalMargins.small,
}
const stylesIcon = {
  marginTop: globalMargins.small,
  marginBottom: globalMargins.small,
}
const stylesInput = {
  alignSelf: 'stretch',
}
const stylesButton = {
  marginTop: globalMargins.medium,
  marginBottom: globalMargins.small,
}

export default InviteCodeRender
