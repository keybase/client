// @flow
import * as WaitingConstants from '../../constants/waiting'
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import DeviceRevoke from '.'
import {connect, type TypedState} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState) => ({
  _endangeredTLFs: Constants.getEndangeredTLFs(state, state.devices.selectedDeviceID),
  device: Constants.getDevice(state, state.devices.selectedDeviceID),
  waiting: WaitingConstants.anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  _onSubmit: (deviceID: Types.DeviceID) => dispatch(DevicesGen.createRevoke({deviceID})),
  onCancel: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  device: stateProps.device,
  endangeredTLFs: stateProps._endangeredTLFs.toArray(),
  onCancel: dispatchProps.onCancel,
  onSubmit: () => dispatchProps._onSubmit(stateProps.device.deviceID),
  waiting: stateProps.waiting,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(DeviceRevoke)
