// @flow
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import * as I from 'immutable'
import DeviceRevoke from '.'
import {connect, type TypedState} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'

const empty = I.Set()
const mapStateToProps = (state: TypedState, {routeProps}) => {
  const deviceID = routeProps.get('deviceID')
  const device = Constants.getDevice(state, deviceID)

  return {
    currentDevice: device.currentDevice,
    deviceID,
    endangeredTLFs: state.devices.endangeredTLFMap.get(deviceID, empty),
    name: device.name,
    type: device.type,
    waiting: Constants.isWaiting(state),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  onCancel: () => dispatch(navigateUp()),
  onSubmit: () => dispatch(DevicesGen.createDeviceRevoke({deviceID: routeProps.get('deviceID')})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  currentDevice: stateProps.currentDevice,
  deviceID: stateProps.deviceID,
  endangeredTLFs: stateProps.endangeredTLFs.toArray(),
  name: stateProps.name,
  onCancel: dispatchProps.onCancel,
  onSubmit: dispatchProps.onSubmit,
  type: stateProps.type,
  waiting: stateProps.waiting,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(DeviceRevoke)
