// @flow
import CodePage from '../login/register/code-page'
import GenPaperKey from './gen-paper-key'
import React, {Component} from 'react'
import RemoveDevice from './device-revoke'
import Render from './render'
import ShowDevice from './device-page'
import _ from 'lodash'
import {addNewPhone, addNewComputer, addNewPaperKey} from '../actions/login'
import {connect} from 'react-redux'
import {loadDevices} from '../actions/devices'
import {routeAppend} from '../actions/router'

class Devices extends Component {
  componentWillMount () {
    const {devices, waitingForServer, loggedIn} = this.props

    if (loggedIn && !devices && !waitingForServer) {
      this.props.loadDevices()
    }
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Devices'},
      subRoutes: {
        codePage: CodePage,
        genPaperKey: GenPaperKey,
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
  (state: any) => {
    const {devices, waitingForServer, error} = state.devices
    const {loggedIn} = state.config
    return {devices, waitingForServer, error, loggedIn}
  },
  (dispatch: any) => {
    return {
      loadDevices: () => dispatch(loadDevices()),
      showExistingDevicePage: device => dispatch(routeAppend({path: 'showDevice', device})),
      showRemoveDevicePage: device => dispatch(routeAppend({path: 'removeDevice', device})),
      addNewPhone: () => dispatch(addNewPhone()),
      addNewComputer: () => dispatch(addNewComputer()),
      addNewPaperKey: () => dispatch(addNewPaperKey()),
    }
  })(Devices)
