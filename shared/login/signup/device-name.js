/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import Render from '../register/set-public-name/index.render'
import * as signupActions from '../../actions/signup'

class DeviceName extends Component {
  state: {
    deviceName: ?string
  };

  constructor (props) {
    super(props)
    this.state = {deviceName: props.deviceName}
  }

  render () {
    return (
      <Render
        deviceName={this.state.deviceName}
        deviceNameError={this.props.deviceNameError}
        onChange={deviceName => this.setState({deviceName})}
        onSubmit={() => this.props.submitDeviceName(this.state.deviceName || '')}
        onBack={this.props.resetSignup}
        waiting={this.props.waiting} />
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
