import React, {Component} from 'react'
import {connect} from 'react-redux'

import CodePage from '../login/register/code-page'
import GenPaperKey from './gen-paper-key'
import ExistingDevice from './existing-device'
import RemoveDevice from './remove-device'

import {loadDevices} from '../actions/devices'
import {routeAppend} from '../actions/router'
import {addANewDevice} from '../actions/login'
import Render from './index.render'

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
        removeDevice: RemoveDevice
      }
    }
  }

  render () {
    return (
      <Render
        devices={this.props.devices}
        waitingForServer={this.props.waitingForServer}
        showRemoveDevicePage={this.props.showRemoveDevicePage}
        showExistingDevicePage={this.props.showExistingDevicePage}
        showGenPaperKeyPage={this.props.showGenPaperKeyPage}/>
    )
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

export default connect(
  state => {
    const {devices, waitingForServer, error} = state.devices
    return {devices, waitingForServer, error}
  },
  dispatch => {
    return {
      loadDevices: () => dispatch(loadDevices()),
      showRemoveDevicePage: device => dispatch(routeAppend({path: 'removeDevice', device})),
      showExistingDevicePage: () => dispatch(addANewDevice()),
      showGenPaperKeyPage: () => dispatch(routeAppend('genPaperKey'))
    }
  })(Devices)
