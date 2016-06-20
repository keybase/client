/* @flow */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Input, Button, Icon} from '../../common-adapters'
import Container from '../forms/container'
import type {Props} from './invite-code.render'

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
        <Text style={stylesHeader} type='Header'>Type in your invite code:</Text>
        <Icon style={stylesIcon} type='invite-code-m' />
        <Input autoFocus style={stylesInput} hintText='goddess brown result reject' value={this.state.inviteCode} errorText={this.props.inviteCodeErrorText} onEnterKeyDown={submitInviteCode} onChange={event => this.setState({inviteCode: event.target.value})} />
        <Button style={stylesButton} waiting={this.props.waiting} type='Primary' label='Continue' onClick={submitInviteCode} disabled={!this.state.inviteCode} />
        <Text style={stylesText} type='Body'>Not invited?</Text>
        <Text type='BodyPrimaryLink' onClick={this.props.onRequestInvite}>Request an invite code</Text>
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
}
const stylesHeader = {
  marginTop: 30,
}
const stylesIcon = {
  marginTop: 75,
}
const stylesInput = {
  height: 45,
  marginTop: 75,
  width: 450,
}
const stylesText = {
  marginTop: 40,
}

export default Render
