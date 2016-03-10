/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Input, Button, Icon} from '../../common-adapters'
import Container from '../forms/container'
import type {Props} from './invite-code.render'

export default class Render extends Component {
  props: Props;

  render () {
    let inviteRef = null
    const submitInviteCode = () => {
      const inviteCode = inviteRef && inviteRef.getValue() || ''
      this.props.onInviteCodeSubmit(inviteCode)
    }
    return (
      <Container onBack={this.props.onBack} style={styles.container}>
        <Text style={{paddingTop: 15}} type='Header'>Type in your invite code:</Text>
        <Icon style={{paddingTop: 50}} type='invite-code'/>
        <Input style={{alignSelf: 'stretch', paddingTop: 20, paddingBottom: 60, height: 50}} ref={r => (inviteRef = r)} floatingLabelText='Invite Code' value={this.props.inviteCode || ''} errorText={this.props.inviteCodeErrorText} onEnterKeyDown={submitInviteCode}/>
        <Button style={{alignSelf: 'flex-end'}} type='Primary' label='Continue' onClick={submitInviteCode}/>
        <Text type='Body'>Not invited?</Text>
        <Text type='Body'>Request an invite code</Text>
      </Container>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    justifyContent: 'space-around',
    alignItems: 'center',
    flex: 1
  },
  continue: {
    justifyContent: 'flex-end'
  }
}
