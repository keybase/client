/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../../styles/style-guide'
import {Text, Button, Checkbox} from '../../../common-adapters'

import type {Props} from './index.render'

export default class Render extends Component {
  props: Props;

  state: {
    inWallet: boolean
  };

  constructor (props: Props) {
    super(props)
    this.state = {inWallet: false}
  }

  render () {
    return (
      <div style={styles.form}>
        <Text type='Header'>{"House-ton we have lift off! you've just joined Keybase"}</Text>
        <Text type='Body'>{'Here is your paperkey, save it in your wallet!'}</Text>
        <Text type='TerminalComment'>{this.props.paperkey.stringValue()}</Text>

        <Text type='Body'>{'Is this in your wallet?'}</Text>
        <Checkbox label={'Yes, it is in my wallet. I pinky promise.'} checked={this.state.inWallet} onCheck={inWallet => this.setState({inWallet})} />
        {this.state.inWallet && <Button type='Secondary' label='Continue' onClick={() => this.props.onFinish()} />}
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
