// @flow
import * as WaitingConstants from '../../constants/waiting'
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import DeviceRevoke from '.'
import {connect, type TypedState} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState) => ({
  _device: Constants.getDevice(state, state.devices.selectedDeviceID),
  _endangeredTLFs: Constants.getEndangeredTLFs(state, state.devices.selectedDeviceID),
  waiting: WaitingConstants.anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  _onSubmit: (deviceID: Types.DeviceID) => dispatch(DevicesGen.createRevoke({deviceID})),
  onCancel: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  currentDevice: stateProps._device.currentDevice,
  deviceID: stateProps._device.deviceID,
  endangeredTLFs: stateProps._endangeredTLFs.toArray(),
  name: stateProps._device.name,
  onCancel: dispatchProps.onCancel,
  onSubmit: () => dispatchProps._onSubmit(stateProps._device.deviceID),
  type: stateProps._device.type,
  waiting: stateProps.waiting,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(DeviceRevoke)
