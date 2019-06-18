import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import DevicePage from '.'

type OwnProps = {}

// TODO(newRouter) after committing to new router:
// remove action and code that sets state.devices.selectedDeviceID.
// It's a bad pattern to have navigation distributed across react-navigation
// and our store. device id is purely an argument to the screen, the store
// doesn't care about it.
export default Container.connect(
  (state, ownProps: OwnProps) => ({
    device: Constants.getDevice(state, Container.getRouteProps(ownProps, 'deviceID')),
  }),
  dispatch => ({
    _showRevokeDevicePage: (deviceID: Types.DeviceID) =>
      dispatch(DevicesGen.createShowRevokePage({deviceID})),
    onBack: () => {
      Container.isMobile && dispatch(RouteTreeGen.createNavigateUp())
    },
  }),
  (stateProps, dispatchProps) => ({
    device: stateProps.device,
    onBack: dispatchProps.onBack,
    showRevokeDevicePage: () => dispatchProps._showRevokeDevicePage(stateProps.device.deviceID),
  })
)(DevicePage)
