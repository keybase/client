// @flow
import Render from '.'
import {List} from 'immutable'
import {addNewPhone, addNewComputer, addNewPaperKey} from '../actions/login'
import {connect} from 'react-redux'
import {lifecycle} from 'recompose'
import {loadDevices} from '../actions/devices'
import {navigateAppend} from '../actions/route-tree'

// TODO remvoe this class
// class Devices extends Component {
  // componentWillMount () {
    // this.props.loadDevices()
  // }

  // render () {
    // // Divide the devices array into not-revoked and revoked.
    // const [devices, revokedDevices] = _.partition(this.props.devices, dev => !dev.revokedAt)

    // return (
      // <Render
        // devices={devices}
        // revokedDevices={revokedDevices}
        // showingRevoked={this.props.showingRevoked}
        // onToggleShowRevoked={this.props.onToggleShowRevoked}
        // addNewPhone={this.props.addNewPhone}
        // addNewComputer={this.props.addNewComputer}
        // addNewPaperKey={this.props.addNewPaperKey}
        // waitingForServer={this.props.waitingForServer}
        // showRemoveDevicePage={this.props.showRemoveDevicePage}
        // showExistingDevicePage={this.props.showExistingDevicePage} />
    // )
  // }
// }

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
