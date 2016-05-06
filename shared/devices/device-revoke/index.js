import React, {Component} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import moment from 'moment'

import {devicesTab} from '../../constants/tabs'
import Render from './index.render'
import RemoveDevice from '../device-revoke'

import * as devicesActions from '../../actions/devices'
import {dispatch, navigateUp, routeAppend} from '../../actions/router'

export default class DeviceRevoke extends Component {
  static parseRoute (currentPath) {
    return {
      componentAtTop: {
        title: 'Device revoke',
        props: {
          device: currentPath.get('device')
        }
      }
    }
  }

  render () {
    const {device} = this.props.device
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
      onCancel: () => dispatch(navigateUp())
    }
  }
)(DeviceRevoke)
