import React, {Component} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

import CodePage from '../login/register/code-page'
import GenPaperKey from './gen-paper-key'
import ExistingDevice from './existing-device'
import RemoveDevice from './remove-device'

import {loadDevices} from '../actions/devices'
import {routeAppend} from '../actions/router'
import {addANewDevice} from '../actions/login'

import ShowDevice from './device-page'
import Render from './render'

class Devices extends Component {
  componentWillMount () {
    const {devices, waitingForServer, error} = this.props

    if (!devices && !waitingForServer && !error) {
      this.props.loadDevices()
    }
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Devices'},
      subRoutes: {
        codePage: CodePage,
        genPaperKey: GenPaperKey,
        regExistingDevice: ExistingDevice,
        showDevice: ShowDevice,
        removeDevice: RemoveDevice
      }
    }
  }

  render () {
    // Divide the devices array into not-revoked and revoked.
    const [devices, revokedDevices] = _.partition(this.props.devices, dev => !dev.revokedAt)

    return (
      <Render
        devices={devices}
        revokedDevices={revokedDevices}
        waitingForServer={this.props.waitingForServer}
        addNewDevice={this.props.addNewDevice}
        showRemoveDevicePage={this.props.showRemoveDevicePage}
        showExistingDevicePage={this.props.showExistingDevicePage}
        showGenPaperKeyPage={this.props.showGenPaperKeyPage} />
    )
  }
}

export default connect(
  state => {
    const {devices, waitingForServer, error} = state.devices
    return {devices, waitingForServer, error}
  },
  dispatch => {
    return {
      loadDevices: () => dispatch(loadDevices()),
      showExistingDevicePage: device => dispatch(routeAppend({path: 'showDevice', device})),
      showRemoveDevicePage: device => dispatch(routeAppend({path: 'removeDevice', device})),
      addNewDevice: () => dispatch(addANewDevice()),
      showGenPaperKeyPage: () => dispatch(routeAppend('genPaperKey'))
    }
  })(Devices)
