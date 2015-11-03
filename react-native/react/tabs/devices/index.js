'use strict'
/* @flow */

import React from '../../base-react'
import BaseComponent from '../../base-component'

import CodePage from '../../login2/register/code-page'
import GenPaperKey from './gen-paper-key'
import ExistingDevice from '../../login2/register/existing-device'
import RemoveDevice from './remove-device'

import { loadDevices } from '../../actions/devices'
import { routeAppend } from '../../actions/router'
import DevicesRender from './devices-render'

export default class Devices extends BaseComponent {
  constructor (props) {
    super(props)
  }

  componentWillMount () {
    if (!this.props.devices && !this.props.waitingForServer) {
      this.props.loadDevices()
    }
  }

  connectNew () {
    console.log('Add device')
  }

  addPaperKey () {
    console.log('Add paper key')
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
          showExistingDevicePage: () => store.dispatch(routeAppend('regExistingDevice')),
          showGenPaperKeyPage: () => store.dispatch(routeAppend('genPaperKey'))
        },
        subRoutes: {
          codePage: CodePage,
          genPaperKey: GenPaperKey,
          regExistingDevice: ExistingDevice,
          removeDevice: RemoveDevice
        }
      }
    }
  }

  render () {
    return <DevicesRender devices={this.props.devices} showRemoveDevicePage={this.props.showRemoveDevicePage} showExistingDevicePage={this.props.showExistingDevicePage} showGenPaperKeyPage={this.props.showGenPaperKeyPage} />
  }
}
