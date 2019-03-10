// @flow
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import * as Types from '../../constants/types/devices'
import {NavigationActions, withNavigation} from '@react-navigation/core'
import flags from '../../util/feature-flags'
import {namedConnect} from '../../util/container'
import DeviceRow from '.'

type OwnProps = {deviceID: Types.DeviceID, firstItem: boolean, navigation?: any}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const device = Constants.getDevice(state, ownProps.deviceID)
  return {
    isCurrentDevice: device.currentDevice,
    isNew: !!state.devices.getIn(['isNew', device.deviceID], false),
    isRevoked: !!device.revokedByName,
    name: device.name,
    type: device.type,
  }
}

const mapDispatchToProps = dispatch => ({
  _showExistingDevicePage: (deviceID: Types.DeviceID) =>
    dispatch(DevicesGen.createShowDevicePage({deviceID})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  firstItem: ownProps.firstItem,
  isCurrentDevice: stateProps.isCurrentDevice,
  isNew: stateProps.isNew,
  isRevoked: stateProps.isRevoked,
  name: stateProps.name,
  showExistingDevicePage: () => {
    if (flags.useNewRouter && ownProps.navigation) {
      ownProps.navigation.dispatch(
        NavigationActions.navigate({params: {deviceID: ownProps.deviceID}, routeName: 'devicePage'})
      )
    } else {
      dispatchProps._showExistingDevicePage(ownProps.deviceID)
    }
  },
  type: stateProps.type,
})

let _ConnectedDeviceRow = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'DeviceRow'
)(DeviceRow)

const ConnectedDeviceRow = flags.useNewRouter ? withNavigation(_ConnectedDeviceRow) : _ConnectedDeviceRow
export default ConnectedDeviceRow
