// @flow
import * as DevicesGen from '../../actions/devices-gen'
import * as I from 'immutable'
import * as Constants from '../../constants/devices'
import DeviceRevoke from './'
import {connect, type TypedState} from '../../util/container'
import {isMobile} from '../../constants/platform'
import {navigateUp} from '../../actions/route-tree'

const blankDetail = Constants.makeDeviceDetail()

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const deviceID = routeProps.get('deviceID')
  const device = state.devices.idToDetail.get(deviceID, blankDetail)
  const icon = {
    backup: isMobile ? 'icon-paper-key-revoke-64' : 'icon-paper-key-revoke-48',
    desktop: isMobile ? 'icon-computer-revoke-64' : 'icon-computer-revoke-48',
    mobile: isMobile ? 'icon-phone-revoke-64' : 'icon-phone-revoke-48',
  }[device.type]

  return {
    currentDevice: device.currentDevice,
    deviceID,
    endangeredTLFs: state.devices.idToEndangeredTLFs.get(deviceID, I.Set()),
    icon,
    name: device.name,
    waiting: Constants.isWaiting(state)
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  onCancel: () => dispatch(navigateUp()),
  onSubmit: () => dispatch(DevicesGen.createDeviceRevoke({deviceID: routeProps.get('deviceID')})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  currentDevice: stateProps.currentDevice,
  deviceID: stateProps.deviceID,
  endangeredTLFs: stateProps.endangeredTLFs.toArray(),
  icon: stateProps.icon,
  name: stateProps.name,
  onCancel: dispatchProps.onCancel,
  onSubmit: dispatchProps.onSubmit,
  waiting: stateProps.waiting,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(DeviceRevoke)
