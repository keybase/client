// @flow
import React, {Component} from 'react'
import Render from '.'
import _ from 'lodash'
import {addNewPhone, addNewComputer, addNewPaperKey} from '../actions/login'
import {connect} from 'react-redux'
import {loadDevices} from '../actions/devices'
import {navigateAppend} from '../actions/route-tree'

// TODO remvoe this class
class Devices extends Component {
  componentWillMount () {
    const {waitingForServer, loggedIn} = this.props

    if (loggedIn && !waitingForServer) {
      this.props.loadDevices()
    }
  }

  render () {
    // Divide the devices array into not-revoked and revoked.
    const [devices, revokedDevices] = _.partition(this.props.devices, dev => !dev.revokedAt)

    return (
      <Render
        devices={devices}
        revokedDevices={revokedDevices}
        showingRevoked={this.props.showingRevoked}
        onToggleShowRevoked={this.props.onToggleShowRevoked}
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
  (state: any, {routeState}) => {
    const {devices, waitingForServer} = state.devices
    const {loggedIn} = state.config
    const {showingRevoked} = routeState
    return {
      devices: devices.toJS(),
      loggedIn,
      showingRevoked,
      waitingForServer,
    } // toJS is temp
  },
  (dispatch: any, {routeState, setRouteState}) => {
    return {
      addNewComputer: () => dispatch(addNewComputer()),
      addNewPaperKey: () => dispatch(addNewPaperKey()),
      addNewPhone: () => dispatch(addNewPhone()),
      loadDevices: () => dispatch(loadDevices()),
      onToggleShowRevoked: () => { setRouteState({showingRevoked: !routeState.showingRevoked}) },
      showExistingDevicePage: device => dispatch(navigateAppend([{props: {device}, selected: 'devicePage'}])),
    }
  })(Devices)
