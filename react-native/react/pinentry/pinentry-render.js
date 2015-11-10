'use strict'
/* @flow */

import React from 'react'
import BaseComponent from '../base-component'
import { TextField, RaisedButton } from 'material-ui'

export default class PinentryRender extends BaseComponent {
  componentWillMount () {
    this.state = {
      passphrase: ''
    }
  }

  render () {
    return (
      <div>
        <p>Please enter the Keybase passphrase for {this.props.user} (12+ characters)</p>
        <TextField
          ref='passphrase'
          onChange={e => this.setState({passphrase: e.target.value})}
          floatingLabelText='Your passphrase'
          value={this.state.passphrase} />

        <RaisedButton style={{margin: 5}} onClick={() => this.props.onCancel()} label='Cancel' />

        <RaisedButton style={{margin: 5}} onClick={() => this.props.onSubmit(this.state.passphrase)} label='OK' />
      </div>
    )
  }
}

PinentryRender.propTypes = {
  onSubmit: React.PropTypes.func.isRequired,
  onCancel: React.PropTypes.func.isRequired,
  user: React.PropTypes.string.isRequired
}
