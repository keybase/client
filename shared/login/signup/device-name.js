// @flow
import * as signupActions from '../../actions/signup'
import React, {Component} from 'react'
import Render from '../register/set-public-name/index.render'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

class DeviceName extends Component {
  state: {
    deviceName: ?string,
  }

  constructor(props) {
    super(props)
    this.state = {deviceName: props.deviceName}
  }

  render() {
    return (
      <Render
        deviceName={this.state.deviceName}
        deviceNameError={this.props.deviceNameError}
        onChange={deviceName => this.setState({deviceName})}
        onSubmit={() =>
          this.props.submitDeviceName(this.state.deviceName || '')}
        submitEnabled={!this.props.waiting}
        onBack={this.props.restartSignup}
        waiting={this.props.waiting}
      />
    )
  }
}

// $FlowIssue type this connector
export default connect(
  state => ({
    deviceNameError: state.signup.deviceNameError,
    deviceName: state.signup.deviceName,
    waiting: state.signup.waiting,
  }),
  dispatch => bindActionCreators(signupActions, dispatch)
)(DeviceName)
