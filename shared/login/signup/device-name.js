// @flow
import * as signupActions from '../../actions/signup'
import React, {Component} from 'react'
import Render from '../register/set-public-name'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

class DeviceName extends Component<any, {deviceName: ?string}> {
  constructor(props) {
    super(props)
    this.state = {deviceName: props.deviceName}
  }

  _onChange = (deviceName: string) => {
    this.setState({
      deviceName,
    })
    if (this.props.deviceNameError) {
      this.props.clearDeviceNameError()
    }
  }

  render() {
    return (
      <Render
        deviceName={this.state.deviceName}
        deviceNameError={this.props.deviceNameError}
        clearDeviceNameError={this.props.clearDeviceNameError}
        onChange={this._onChange}
        onSubmit={() => this.props.submitDeviceName(this.state.deviceName || '')}
        submitEnabled={!this.props.waiting}
        onBack={this.props.restartSignup}
        waiting={this.props.waiting}
      />
    )
  }
}

export default connect(
  state => ({
    deviceNameError: state.signup.deviceNameError,
    deviceName: state.signup.deviceName,
    waiting: state.signup.waiting,
  }),
  dispatch => bindActionCreators(signupActions, dispatch)
)(DeviceName)
