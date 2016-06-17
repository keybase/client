// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

import CodePage from '../login/register/code-page'
import GenPaperKey from './gen-paper-key'
import ExistingDevice from './existing-device'

import {loadDevices} from '../actions/devices'
import {routeAppend} from '../actions/router'
import {addNewPhone, addNewComputer, addNewPaperKey} from '../actions/login'

import ShowDevice from './device-page'
import RemoveDevice from './device-revoke'

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
        removeDevice: RemoveDevice,
      },
    }
  }

  render () {
    // Divide the devices array into not-revoked and revoked.
    const [devices, revokedDevices] = _.partition(this.props.devices, dev => !dev.revokedAt)

    return (
      <Render
        devices={devices}
        revokedDevices={revokedDevices}
        addNewPhone={this.props.addNewPhone}
        addNewComputer={this.props.addNewComputer}
        addNewPaperKey={this.props.addNewPaperKey}
        waitingForServer={this.props.waitingForServer}
        showRemoveDevicePage={this.props.showRemoveDevicePage}
        showExistingDevicePage={this.props.showExistingDevicePage} />
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
      addNewPhone: () => dispatch(addNewPhone()),
      addNewComputer: () => dispatch(addNewComputer()),
      addNewPaperKey: () => dispatch(addNewPaperKey()),
    }
  })(Devices)
