// @flow
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import DevicePage from '.'
import {namedConnect} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = {||}

const mapStateToProps = state => ({
  device: Constants.getDevice(state, state.devices.selectedDeviceID),
})

const mapDispatchToProps = dispatch => ({
  _showRevokeDevicePage: (deviceID: Types.DeviceID) => dispatch(DevicesGen.createShowRevokePage({deviceID})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  device: stateProps.device,
  onBack: dispatchProps.onBack,
  showRevokeDevicePage: () => dispatchProps._showRevokeDevicePage(stateProps.device.deviceID),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'DevicePage'
)(DevicePage)
