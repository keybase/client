// @flow
import * as Types from '../constants/types/devices'
import {connect, type TypedState} from '../util/container'
import {isMobile} from '../constants/platform'
import {navigateAppend} from '../actions/route-tree'
import {type IconType} from '../common-adapters/icon'

type OwnProps = {
  deviceID: Types.DeviceID,
}

const mapStateToProps = (state: TypedState, {deviceID}: OwnProps) => {
  const device = state.devices.idToDetail.get(deviceID)
  if (!device) {
    return {}
  }

  const icon: IconType = {
    backup: isMobile ? 'icon-paper-key-48' : 'icon-paper-key-32',
    desktop: isMobile ? 'icon-computer-48' : 'icon-computer-32',
    mobile: isMobile ? 'icon-phone-48' : 'icon-phone-32',
  }[device.type]

  return {
    icon,
    isCurrentDevice: device.currentDevice,
    isRevoked: !!device.revokedByName,
    name: device.name,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _showExistingDevicePage: (deviceID: string) =>
    dispatch(navigateAppend([{props: {deviceID}, selected: 'devicePage'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  showExistingDevicePage: () => dispatchProps._showExistingDevicePage(ownProps.deviceID),
})

const RowConnector = connect(mapStateToProps, mapDispatchToProps, mergeProps)
export {RowConnector}
