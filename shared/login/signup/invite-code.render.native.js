// @flow
import Container from '../forms/container'
import React, {Component} from 'react'
import type {Props} from './invite-code.render'
import {Text, Input, Button, Icon, Box} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'

class Render extends Component {
  props: Props;

  state: {
    inviteCode: ?string
  };

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
        <Icon style={stylesIcon} type='icon-invite-code-48' />
        <Input autoFocus={true} style={stylesInput} hintText='goddess brown result reject' value={this.state.inviteCode} errorText={this.props.inviteCodeErrorText} onEnterKeyDown={submitInviteCode} onChangeText={inviteCode => this.setState({inviteCode})} />
        <Button style={stylesButton} waiting={this.props.waiting} type='Primary' label='Continue' onClick={submitInviteCode} disabled={!this.state.inviteCode} />
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
export default Render
