// @flow
import * as Constants from '../../constants/devices'
import * as Types from '../../constants/types/devices'
import {connect, compose, type TypedState, setDisplayName} from '../../util/container'
import {navigateAppend} from '../../actions/route-tree'
import DeviceRow from '.'

type OwnProps = {deviceID: Types.DeviceID, firstItem: boolean}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const device = Constants.getDevice(state, ownProps.deviceID)
  return {
    isCurrentDevice: device.currentDevice,
    isRevoked: !!device.revokedByName,
    name: device.name,
    type: device.type,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _showExistingDevicePage: (deviceID: string) =>
    dispatch(navigateAppend([{props: {deviceID}, selected: 'devicePage'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  firstItem: ownProps.firstItem,
  isCurrentDevice: stateProps.isCurrentDevice,
  isRevoked: stateProps.isRevoked,
  name: stateProps.name,
  showExistingDevicePage: () => dispatchProps._showExistingDevicePage(ownProps.deviceID),
  type: stateProps.type,
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('DeviceRow'))(
  DeviceRow
)
