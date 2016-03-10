/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Input, Button, Icon} from '../../common-adapters'
import Container from '../forms/container'
import type {Props} from './invite-code.render'

export default class Render extends Component {
  props: Props;

  state: {
    inviteCode: ?string
  };

  constructor (props: Props) {
    super(props)
    this.state = {
      inviteCode: ''
    }
  }

  render () {
    const submitInviteCode = () => {
      this.props.onInviteCodeSubmit(this.state.inviteCode)
    }

    return (
      <Container onBack={this.props.onBack} style={styles.container}>
        <Text style={{marginTop: 30}} type='Header'>Type in your invite code:</Text>
        <Icon style={{marginTop: 80}} type='invite-code'/>
        <Input style={{marginTop: 40, alignSelf: 'stretch', height: 50}} hintText='goddess brown result reject' value={this.props.inviteCode || ''} errorText={this.props.inviteCodeErrorText} onEnterKeyDown={submitInviteCode} onChange={event => this.setState({inviteCode: event.target.value})}/>
        <Button style={{marginTop: 40, marginRight: 0, alignSelf: 'flex-end'}} type='Primary' label='Continue' onClick={submitInviteCode} disabled={!this.state.inviteCode}/>
        <Text style={{marginTop: 40}} type='Body'>Not invited?</Text>
        <Text type='BodyPrimaryLink' oncCick={this.props.onRequestInvite}>Request an invite code</Text>
      </Container>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center'
  },
  continue: {
    justifyContent: 'flex-end'
  }
}
