// @flow
import Container from '../forms/container'
import React, {Component} from 'react'
import type {Props} from './request-invite-success.render'
import {Text, Icon} from '../../common-adapters'
import {globalStyles} from '../../styles'

class RequestInviteSuccessRender extends Component<void, Props, void> {
  render() {
    return (
      <Container onBack={this.props.onBack} style={stylesContainer}>
        <Icon style={stylesIcon} type="icon-invite-code-48" />
        <Text style={stylesHeader} type="Header">Invite request sent</Text>
        <Text style={stylesBody} type="Body">
          Thanks for requesting an invite to Keybase. When one becomes available,  we will send it to you via email.
        </Text>
      </Container>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}
const stylesIcon = {
  marginTop: 80 - 11,
}
const stylesHeader = {
  marginTop: 50 - 11,
  marginBottom: 10,
}
const stylesBody = {
  paddingLeft: 15,
  paddingRight: 15,
  marginBottom: 35,
  maxWidth: 560,
  textAlign: 'center',
}

export default RequestInviteSuccessRender
