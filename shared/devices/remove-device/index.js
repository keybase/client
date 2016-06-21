import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './index.render'

import {removeDevice} from '../../actions/devices'
import {navigateUp} from '../../actions/router'

class RemoveDevice extends Component {
  render () {
    return (
      <Render
        deviceName={this.props.device.name}
        onCancel={this.props.navigateUp}
        onSubmit={this.props.removeDevice}
      />
    )
  }

  static parseRoute (currentPath) {
    return {componentAtTop: {props: {device: currentPath.get('device')}}}
  }
}

RemoveDevice.propTypes = {
  device: React.PropTypes.object.isRequired,
  navigateUp: React.PropTypes.func.isRequired,
  removeDevice: React.PropTypes.func.isRequired,
}

export default connect(
  null,
  (dispatch, ownProps) => {
    return {
      navigateUp: () => dispatch(navigateUp()),
      removeDevice: () => dispatch(removeDevice(ownProps.device.deviceID)),
    }
  })(RemoveDevice)
