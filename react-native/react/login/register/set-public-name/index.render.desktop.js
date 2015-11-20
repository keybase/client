import React, {Component} from '../../../base-react'
import {TextField, RaisedButton} from 'material-ui'

export default class SetPublicNameRender extends Component {
  render () {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: 20}}>
        <h1>Set a public name for this device</h1>
        <h2>We need this because lorem iplorem iplorem iplorem iplorem ipssssslorem ips</h2>
        <TextField
          hintText='Device Nickname'
          floatingLabelText='Nickname'
          value={this.props.deviceName}
          onEnterKeyDown={() => this.props.onSubmit()}
          onChange={event => this.props.onChangeDeviceName(event.target.value)}
        />
        { this.props.nameTaken &&
          <p>{`The device name: ${this.props.deviceName} is already taken`}</p>
        }
        <RaisedButton
          style={{alignSelf: 'flex-end', marginTop: 20}}
          label='Submit'
          primary
          onClick={() => this.props.onSubmit()}
          disabled={!this.props.submitEnabled}
        />
      </div>
    )
  }
}

SetPublicNameRender.propTypes = {
  deviceName: React.PropTypes.string,
  onSubmit: React.PropTypes.func.isRequired,
  onChangeDeviceName: React.PropTypes.func.isRequired,
  nameTaken: React.PropTypes.bool.isRequired,
  submitEnabled: React.PropTypes.bool.isRequired
}
