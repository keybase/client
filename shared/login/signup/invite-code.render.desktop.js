/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Input, Button} from '../../common-adapters'

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
      <div style={styles.form}>
        <Text style={styles.topMargin} type='Header'>Enter your special invite code</Text>
        <Input ref={r => (inviteRef = r)} hintText='Invite Code' errorText={this.props.inviteCodeErrorText} onEnterKeyDown={submitInviteCode}/>
        <Button type='Secondary' label='Check' onClick={submitInviteCode}/>
      </div>
    )
  }
}

const styles = {
  form: {
    ...globalStyles.flexBoxColumn,
    flex: 1
  },

  topMargin: {
    marginTop: 20
  }
}
