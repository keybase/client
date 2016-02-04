/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Input, Button} from '../../common-adapters'

import type {Props} from './inviteCode.render'

export default class Render extends Component {
  props: Props;

  render (): ReactElement {
    return (
      <div style={styles.form}>
        <Text style={styles.topMargin} type='Header'>Enter your special invite code</Text>
        <Input hintText='Invite Code' errorText={this.props.inviteCodeErrorText} onEnterKeyDown={this.props.onInviteCodeSubmit}/>
        <Button label='Check' onClick={this.props.onInviteCodeSubmit}/>
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
