'use strict'

import React, {Component} from '../../base-react'

import CodePage from '../../login2/register/code-page'
import GenPaperKey from './gen-paper-key'
import ExistingDevice from '../../login2/register/existing-device'
import RemoveDevice from './remove-device'

import {loadDevices} from '../../actions/devices'
import {routeAppend} from '../../actions/router'
import {addANewDevice} from '../../actions/login2'
import DevicesRender from './index.render'

export default class Devices extends Component {
  componentWillMount () {
    const {devices, waitingForServer, error} = this.props

    if (!devices && !waitingForServer && !error) {
      this.props.loadDevices()
    }
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Devices',
        mapStateToProps: state => {
          const { devices, waitingForServer, error } = state.devices
          return {
            devices,
            waitingForServer,
            error
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
    return <DevicesRender
             devices={this.props.devices}
             waitingForServer={this.props.waitingForServer}
             showRemoveDevicePage={this.props.showRemoveDevicePage}
             showExistingDevicePage={this.props.showExistingDevicePage}
             showGenPaperKeyPage={this.props.showGenPaperKeyPage}/>
  }
}

Devices.propTypes = {
  devices: React.PropTypes.array,
  error: React.PropTypes.any,
  waitingForServer: React.PropTypes.bool,
  loadDevices: React.PropTypes.func.isRequired,
  showRemoveDevicePage: React.PropTypes.func.isRequired,
  showExistingDevicePage: React.PropTypes.func.isRequired,
  showGenPaperKeyPage: React.PropTypes.func.isRequired
}
