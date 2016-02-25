/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

// $FlowFixMe we should flow type this component
import Render from '../register/set-public-name/index.render'
import {submitDeviceName} from '../../actions/signup'

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
        onChangeDeviceName={deviceName => this.setState({deviceName})}
        onSubmit={() => this.props.submitDeviceName(this.state.deviceName || '')}
        submitEnabled/>
    )
  }
}

DeviceName.propTypes = {
  deviceName: React.PropTypes.string,
  deviceNameError: React.PropTypes.string,
  submitDeviceName: React.PropTypes.func
}

export default connect(
  state => ({
    deviceNameError: state.signup.deviceNameError,
    deviceName: state.signup.deviceName
  }),
  dispatch => bindActionCreators({submitDeviceName}, dispatch)
)(DeviceName)
