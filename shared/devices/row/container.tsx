import * as Container from '../../util/container'
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import type * as Types from '../../constants/types/devices'
import DeviceRow from '.'

type OwnProps = {
  deviceID: Types.DeviceID
  firstItem: boolean
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const device = Constants.getDevice(state, ownProps.deviceID)
  return {
    device,
    isCurrentDevice: device.currentDevice,
    isNew: state.devices.isNew.has(device.deviceID),
    isRevoked: !!device.revokedByName,
    name: device.name,
    type: device.type,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _showExistingDevicePage: (deviceID: Types.DeviceID) =>
    dispatch(DevicesGen.createShowDevicePage({deviceID})),
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    device: stateProps.device,
    firstItem: ownProps.firstItem,
    isCurrentDevice: stateProps.isCurrentDevice,
    isNew: stateProps.isNew,
    isRevoked: stateProps.isRevoked,
    name: stateProps.name,
    showExistingDevicePage: () => {
      dispatchProps._showExistingDevicePage(ownProps.deviceID)
    },
    type: stateProps.type,
  })
)(DeviceRow)
