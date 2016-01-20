import React, {Component} from '../../base-react'
import {connect} from '../../base-redux'
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
  removeDevice: React.PropTypes.func.isRequired
}

export default connect(
  null,
  dispatch => {
    return {
      navigateUp: () => dispatch(navigateUp()),
      removeDevice: deviceID => dispatch(removeDevice(deviceID))
    }
  },
  (stateProps, dispatchProps, ownProps) => {
    return {
      ...ownProps,
      ...stateProps,
      ...dispatchProps,
      removeDevice: () => dispatchProps.removeDevice(ownProps.device.deviceID)
    }
  }

)(RemoveDevice)
