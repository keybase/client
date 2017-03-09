// @flow
import Render from '.'
import {List} from 'immutable'
import {addNewPhone, addNewComputer, addNewPaperKey} from '../actions/login'
import {connect} from 'react-redux'
import {lifecycle} from 'recompose'
import {loadDevices} from '../actions/devices'
import {navigateAppend} from '../actions/route-tree'

const Devices = lifecycle({
  componentWillMount: function () {
    this.props.loadDevices()
  },
})(Render)

export default connect(
  (state: any, {routeState}) => {
    const {devices: allDevices, waitingForServer} = state.devices
    const {showingRevoked} = routeState

    const split = allDevices.groupBy(d => d.revokedAt ? 'revokedDevices' : 'devices')
    const devices = split.get('devices', List())
    const revokedDevices = split.get('revokedDevices', List())

    return {
      devices: devices.toJS(), // toJS is temp
      revokedDevices: revokedDevices.toJS(),
      showingRevoked,
      waitingForServer,
    }
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
