// @flow
import React, {Component} from 'react'
import Render from './render'
import _ from 'lodash'
import {addNewPhone, addNewComputer, addNewPaperKey} from '../actions/login'
import {connect} from 'react-redux'
import {loadDevices} from '../actions/devices'
import {navigateAppend} from '../actions/route-tree'

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
    const {devices, waitingForServer, error} = state.devices
    const {loggedIn} = state.config
    const {showingRevoked} = routeState
    return {devices, waitingForServer, error, loggedIn, showingRevoked}
  },
  (dispatch: any, {routeState, setRouteState}) => {
    return {
      loadDevices: () => dispatch(loadDevices()),
      onToggleShowRevoked: () => { setRouteState({showingRevoked: !routeState.showingRevoked}) },
      showExistingDevicePage: device => dispatch(navigateAppend([{selected: 'devicePage', device}])),
      addNewPhone: () => dispatch(addNewPhone()),
      addNewComputer: () => dispatch(addNewComputer()),
      addNewPaperKey: () => dispatch(addNewPaperKey()),
    }
  })(Devices)
