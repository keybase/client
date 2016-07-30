// @flow
import * as devicesActions from '../../actions/devices'
import React, {Component} from 'react'
import Render from './index.render'
import type {Props} from './index.render'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {navigateUp} from '../../actions/router'

class DeviceRevoke extends Component<void, Props, void> {
  static parseRoute (currentPath) {
    return {
      componentAtTop: {
        title: 'Device revoke',
        props: {
          device: currentPath.get('device'),
        },
      },
    }
  }

  render () {
    const device = this.props.device
    return <Render
      name={device.name}
      type={device.type}
      deviceID={device.deviceID}
      currentDevice={device.currentDevice}
      device={device}
      onSubmit={this.props.onSubmit}
      onCancel={this.props.onCancel}
    />
  }
}

export default connect(
  (state, ownProps) => {
    return ownProps
  },
  dispatch => {
    return {
      ...bindActionCreators(devicesActions, dispatch),
      onSubmit: ({deviceID, name, currentDevice}) => {
        dispatch(devicesActions.removeDevice(deviceID, name, currentDevice))
      },
      onCancel: () => dispatch(navigateUp()),
    }
  }
)(DeviceRevoke)
