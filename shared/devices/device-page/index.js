import React, {Component} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import moment from 'moment'

import Render from './index.render'
import RemoveDevice from '../device-revoke'

import * as devicesActions from '../../actions/devices'
import {routeAppend} from '../../actions/router'

export default class DevicePage extends Component {
  static parseRoute (currentPath) {
    return {
      componentAtTop: {
        title: 'Device page',
        props: {
          device: currentPath.get('device')
        }
      },
      subRoutes: {
        removeDevice: RemoveDevice
      }
    }
  }

  _buildTimeline (device) {
    const added = moment(device.created)
    const timeline = []
    if (device.revokedAt) {
      const revoked = moment(device.revokedAt)
      timeline.push({
        type: 'Revoked',
        desc: 'Revoked ' + revoked.format('MMM D, YYYY'),
        subDesc: revoked.fromNow()
      })
    }
    timeline.push({
      type: 'Added',
      desc: 'Added ' + added.format('MMM D, YYYY'),
      subDesc: device.provisioner ? device.provisioner.name : ''
    })
    return timeline
  }

  render () {
    const {device} = this.props
    const timeline = this._buildTimeline(device)

    return <Render
      name={device.name}
      type={device.type}
      deviceID={device.deviceID}
      timeline={timeline}
      revokedAt={device.revokedAt}
      currentDevice={device.currentDevice}
      showRemoveDevicePage={this.props.showRemoveDevicePage}
      device={device}
    />
  }
}

export default connect(
  (state, ownProps) => {
    const devices = state.devices.devices.filter(device => { return device.name === ownProps.device.name })
    return ({
      ...devices,
      ...ownProps
    })
  },
  dispatch => {
    return {
      ...bindActionCreators(devicesActions, dispatch),
      showRemoveDevicePage: device => dispatch(routeAppend({path: 'removeDevice', device}))
    }
  }
)(DevicePage)
