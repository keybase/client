// @flow
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import DevicePage from '.'
import moment from 'moment'
import {compose, connect, type TypedState, setDisplayName} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'

const buildTimeline = (device: Types.Device) => {
  const revoked = device.get('revokedAt') && [
    {
      desc: `Revoked ${moment(device.get('revokedAt')).format('MMM D, YYYY')}`,
      subDesc: device.revokedByName || '',
      type: 'Revoked',
    },
  ]

  const lastUsed = device.lastUsed && [
    {
      desc: `Last used ${moment(device.get('lastUsed')).format('MMM D, YYYY')}`,
      subDesc: moment(device.lastUsed).fromNow(),
      type: 'LastUsed',
    },
  ]

  const added = {
    desc: `Added ${moment(device.get('created')).format('MMM D, YYYY')}`,
    subDesc: device.provisionerName || '',
    type: 'Added',
  }

  return [...(revoked || []), ...(lastUsed || []), added]
}

const mapStateToProps = (state: TypedState) => ({
  device: Constants.getDevice(state, state.devices.selectedDeviceID),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _showRevokeDevicePage: (deviceID: Types.DeviceID) => dispatch(DevicesGen.createShowRevokePage({deviceID})),
  onBack: () => dispatch(navigateUp()),
})

const revokeName = type =>
  ({
    backup: 'paper key',
    desktop: 'device',
    mobile: 'device',
  }[type])

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  currentDevice: stateProps.device.currentDevice,
  deviceID: stateProps.device.deviceID,
  name: stateProps.device.name,
  onBack: dispatchProps.onBack,
  revokeName: revokeName(stateProps.device.type),
  revokedAt: stateProps.device.revokedAt,
  showRevokeDevicePage: () => dispatchProps._showRevokeDevicePage(stateProps.device.deviceID),
  timeline: buildTimeline(stateProps.device),
  type: stateProps.device.type,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('DevicePage')
)(DevicePage)
