// @flow
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import DevicePage from '.'
import {NavigationActions} from '@react-navigation/core'
import {namedConnect} from '../../util/container'
import flags from '../../util/feature-flags'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = {|navigation: any|}

const mapStateToProps = (state, p: OwnProps) => {
  // TODO(newRouter) after committing to new router:
  // remove action and code that sets state.devices.selectedDeviceID.
  // It's a bad pattern to have navigation distributed across react-navigation
  // and our store device id is purely an argument to the screen, the store
  // doesn't care about it.
  const deviceID = flags.useNewRouter ? p.navigation.getParam('deviceID') : state.devices.selectedDeviceID
  return {
    device: Constants.getDevice(state, deviceID),
  }
}

const mapDispatchToProps = dispatch => ({
  _showRevokeDevicePage: (deviceID: Types.DeviceID) => dispatch(DevicesGen.createShowRevokePage({deviceID})),
  onBack: () => {
    if (flags.useNewRouter) {
    } else {
      dispatch(RouteTreeGen.createNavigateUp())
    }
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  device: stateProps.device,
  onBack: dispatchProps.onBack,
  showRevokeDevicePage: () => {
    const deviceID = stateProps.device.deviceID
    // Needed in the new router since it loads the request endangered tlfs
    // TODO(newRouter) rename this action after commiting to newRouter
    dispatchProps._showRevokeDevicePage(stateProps.device.deviceID)
    if (flags.useNewRouter) {
      ownProps.navigation.dispatch(
        NavigationActions.navigate({params: {deviceID}, routeName: 'deviceRevoke'})
      )
    }
  },
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'DevicePage'
)(DevicePage)
