'use strict'

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
        onCancel={() => this.props.dispatch(navigateUp())}
        onSubmit={() => this.props.dispatch(removeDevice(this.props.device.deviceID))}
      />
    )
  }

  static parseRoute (currentPath) {
    return {componentAtTop: {props: {device: currentPath.get('device')}}}
  }
}

RemoveDevice.propTypes = {
  device: React.PropTypes.object.isRequired,
  dispatch: React.PropTypes.func.isRequired
}

export default connect(
  null,
  dispatch => {
    return {
      navigateUp: () => dispatch(navigateUp()),
      removeDevice: deviceID => dispatch(removeDevice(deviceID))
    }
  }
)(RemoveDevice)
