'use strict'
/* @flow */

import React, { Component } from '../../base-react'

import CodePage from '../../login2/register/code-page'
import GenPaperKey from './gen-paper-key'
import ExistingDevice from '../../login2/register/existing-device'
import RemoveDevice from './remove-device'

import { loadDevices } from '../../actions/devices'
import { routeAppend } from '../../actions/router'
import { addANewDevice } from '../../actions/login2'
import DevicesRender from './devices-render'

export default class Devices extends Component {
  componentWillMount () {
    if (!this.props.devices && !this.props.waitingForServer) {
      this.props.loadDevices()
    }
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Devices',
        mapStateToProps: state => {
          const { devices, waitingForServer } = state.devices
          return {
            devices,
            waitingForServer
          }
        },
        props: {
          loadDevices: () => store.dispatch(loadDevices()),
          showRemoveDevicePage: device => store.dispatch(routeAppend({path: 'removeDevice', device})),
          showExistingDevicePage: () => store.dispatch(addANewDevice()),
          showGenPaperKeyPage: () => store.dispatch(routeAppend('genPaperKey'))
        }
      },
      subRoutes: {
        codePage: CodePage,
        genPaperKey: GenPaperKey,
        regExistingDevice: ExistingDevice,
        removeDevice: RemoveDevice
      }
    }
  }

  render () {
    return <DevicesRender devices={this.props.devices} showRemoveDevicePage={this.props.showRemoveDevicePage} showExistingDevicePage={this.props.showExistingDevicePage} showGenPaperKeyPage={this.props.showGenPaperKeyPage} />
  }
}

Devices.propTypes = {
  devices: React.PropTypes.array,
  waitingForServer: React.PropTypes.bool,
  loadDevices: React.PropTypes.func.isRequired,
  showRemoveDevicePage: React.PropTypes.func.isRequired,
  showExistingDevicePage: React.PropTypes.func.isRequired,
  showGenPaperKeyPage: React.PropTypes.func.isRequired
}
