// @flow
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import * as Types from '../../constants/types/devices'
import {connect, compose, setDisplayName} from '../../util/container'
import DeviceRow from '.'

type OwnProps = {deviceID: Types.DeviceID, firstItem: boolean, isNew: boolean}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const device = Constants.getDevice(state, ownProps.deviceID)
  return {
    isCurrentDevice: device.currentDevice,
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
  isRevoked: stateProps.isRevoked,
  isNew: ownProps.isNew,
  name: stateProps.name,
  showExistingDevicePage: () => dispatchProps._showExistingDevicePage(ownProps.deviceID),
  type: stateProps.type,
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('DeviceRow'))(
  DeviceRow
)
