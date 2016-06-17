/* @flow */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Icon} from '../../common-adapters'
import Container from '../forms/container'

import type {Props} from './request-invite-success.render'

export default class Render extends Component {
  props: Props;

  render () {
    return (
      <Container onBack={this.props.onBack} style={stylesContainer}>
        <Icon style={stylesIcon} type='invite-code-m' />
        <Text style={stylesHeader} type='Header'>Invite request sent</Text>
        <Text style={stylesBody} type='Body'>
          Thanks for requesting an invite to Keybase. When one becomes available, we will send it to you via email.
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
  marginTop: 180,
}
const stylesHeader = {
  marginTop: 55,
  marginBottom: 10,
}
const stylesBody = {
  paddingLeft: 15,
  paddingRight: 15,
  marginBottom: 35,
  textAlign: 'center',
}
