import React, {Component} from 'react'
import {RaisedButton} from 'material-ui'

export default class RemoveDeviceRender extends Component {
  render () {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: 20}}>
        <h1>Remove "{this.props.deviceName}"?</h1>
        <h2>Removing this account will, lorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsum lorem ipsum lorem ipsum </h2>
        <div style={{display: 'flex', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', marginTop: 20}}>
          <RaisedButton style={{marginRight: 10}} label='Cancel' secondary onClick={() => this.props.onCancel()} />
          <RaisedButton label='Delete' primary onClick={() => this.props.onSubmit()} />
        </div>
      </div>
    )
  }
}

RemoveDeviceRender.propTypes = {
  deviceName: React.PropTypes.string.isRequired,
  onCancel: React.PropTypes.func.isRequired,
  onSubmit: React.PropTypes.func.isRequired,
}
