import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import DevicePage from '.'
import {namedConnect, getRouteProps} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {isMobile} from '../../constants/platform'

type OwnProps = {}

const mapStateToProps = (state, p: OwnProps) => {
  // TODO(newRouter) after committing to new router:
  // remove action and code that sets state.devices.selectedDeviceID.
  // It's a bad pattern to have navigation distributed across react-navigation
  // and our store. device id is purely an argument to the screen, the store
  // doesn't care about it.
  const deviceID = getRouteProps(p, 'deviceID')
  return {device: Constants.getDevice(state, deviceID)}
}

const mapDispatchToProps = dispatch => ({
  _showRevokeDevicePage: (deviceID: Types.DeviceID) => dispatch(DevicesGen.createShowRevokePage({deviceID})),
  onBack: () => {
    if (isMobile) {
      dispatch(RouteTreeGen.createNavigateUp())
    }
  },
})

const mergeProps = (stateProps, dispatchProps) => ({
  device: stateProps.device,
  onBack: dispatchProps.onBack,
  showRevokeDevicePage: () => dispatchProps._showRevokeDevicePage(stateProps.device.deviceID),
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'DevicePage')(DevicePage)
