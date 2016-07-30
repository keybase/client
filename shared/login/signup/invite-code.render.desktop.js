// @flow
import Container from '../forms/container'
import React, {Component} from 'react'
import type {Props} from './invite-code.render'
import {Box, Text, Input, Button, Icon} from '../../common-adapters'
import {globalStyles} from '../../styles/style-guide'

type State = {
  inviteCode: ?string
}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      inviteCode: this.props.inviteCode || '',
    }
  }

  render () {
    const submitInviteCode = () => {
      this.props.onInviteCodeSubmit(this.state.inviteCode)
    }

    return (
      <Container onBack={this.props.onBack} style={stylesContainer}>
        <Box style={stylesBox}>
          <Text style={stylesHeader} type='Header'>Type in your invite code:</Text>
          <Icon style={stylesIcon} type='icon-invite-code-48' />
          <Input autoFocus={true} style={stylesInput} hintText='goddess brown result reject' value={this.state.inviteCode} errorText={this.props.inviteCodeErrorText} onEnterKeyDown={submitInviteCode} onChange={event => this.setState({inviteCode: event.target.value})} />
          <Button style={stylesButton} waiting={this.props.waiting} type='Primary' label='Continue' onClick={submitInviteCode} disabled={!this.state.inviteCode} />
          <Text style={stylesText} type='Body'>Not invited?</Text>
          <Text type='BodyPrimaryLink' onClick={this.props.onRequestInvite}>Request an invite code</Text>
        </Box>
      </Container>
    )
  }
}

const stylesButton = {
  marginTop: 10,
  marginRight: 0,
  alignSelf: 'flex-end',
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
  marginTop: 30,
}
const stylesIcon = {
  marginTop: 75 - 14,
}
const stylesInput = {
  height: 45,
  marginTop: 75 - 14,
  width: 450,
}
const stylesText = {
  marginTop: 40,
}

export default Render
