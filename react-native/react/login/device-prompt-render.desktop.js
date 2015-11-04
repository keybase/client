'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import { submitDeviceName } from '../actions/login'
import { TextField, RaisedButton } from 'material-ui'

export default class DevicePromptRender extends BaseComponent {
  constructor (props) {
    super (props)

    this.state = {
      deviceName: props.deviceName || ''
    }
  }

  render () {
    console.log('props are')
    console.log(this.props)
    return (
      <div>
        <h2>Set a device name</h2>
        <p>This is the first time you've logged into this device. You need to register this device by choosing a name. For example, Macbook or Desktop.</p>

        <TextField
          ref='deviceName'
          onChange={e => this.setState({deviceName: e.target.value})}
          placeholder='Device Name'
          hintText='Device Name'
          floatingLabelText='Device Name'
          value={this.state.deviceName} />

        <RaisedButton onClick={() => this.props.onSubmit(this.state.deviceName)} label='Set device name' />
      </div>
    )
  }
}
