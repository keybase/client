'use strict'
/* @flow */

import React, {Component} from '../../../base-react'
import {TextField, RaisedButton} from 'material-ui'

export default class SetPublicNameRender extends Component {
  constructor (props) {
    super(props)

    this.state = {
      deviceName: ''
    }
  }

  onSubmit () {
    this.props.onSubmit(this.state.deviceName)
  }

  render () {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: 20}}>
        <h1>Set a public name for this device</h1>
        <h2>We need this because lorem iplorem iplorem iplorem iplorem ipssssslorem ips</h2>
        <TextField
          hintText='Device Nickname'
          floatingLabelText='Nickname'
          onEnterKeyDown={() => this.onSubmit()}
          onChange={(event) => this.setState({deviceName: event.target.value})}
          value={this.state.deviceName}
        />
        { this.props.nameTaken(this.state.deviceName) &&
          <p>{`The device name: ${this.state.deviceName} is already taken`}</p>
        }
        <RaisedButton
          style={{alignSelf: 'flex-end', marginTop: 20}}
          label='Submit'
          primary
          onClick={() => this.onSubmit()}
          disabled={!this.props.submitEnabled(this.state.deviceName)}
        />
      </div>
    )
  }
}

SetPublicNameRender.propTypes = {
  onSubmit: React.PropTypes.func.isRequired,
  nameTaken: React.PropTypes.func.isRequired,
  submitEnabled: React.PropTypes.func.isRequired
}

