// @flow
import * as WaitingConstants from '../../constants/waiting'
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import DeviceRevoke from '.'
import {connect} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = {||}

const mapStateToProps = state => ({
  _endangeredTLFs: Constants.getEndangeredTLFs(state, state.devices.selectedDeviceID),
  device: Constants.getDevice(state, state.devices.selectedDeviceID),
  waiting: WaitingConstants.anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = (dispatch, {routeProps}) => ({
  _onSubmit: (deviceID: Types.DeviceID) => dispatch(DevicesGen.createRevoke({deviceID})),
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  device: stateProps.device,
  endangeredTLFs: stateProps._endangeredTLFs.toArray(),
  onCancel: dispatchProps.onCancel,
  onSubmit: () => dispatchProps._onSubmit(stateProps.device.deviceID),
  waiting: stateProps.waiting,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(DeviceRevoke)
