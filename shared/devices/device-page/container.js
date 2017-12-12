// @flow
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import DevicePage from '.'
import moment from 'moment'
import {connect, type TypedState} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'
import {type DeviceDetail} from '../../constants/types/devices'

const buildTimeline = (device: DeviceDetail) => {
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

const blankDetail = Constants.makeDeviceDetail()
const mapStateToProps = (state: TypedState, {routeProps}) => ({
  device: state.devices.idToDetail.get(routeProps.get('deviceID'), blankDetail),
})

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  onBack: () => dispatch(navigateUp()),
  showRevokeDevicePage: () =>
    dispatch(DevicesGen.createShowRevokePage({deviceID: routeProps.get('deviceID')})),
})

const icon = type =>
  ({
    backup: 'icon-paper-key-64',
    desktop: 'icon-computer-64',
    mobile: 'icon-phone-64',
  }[type])

const revokeName = type =>
  ({
    backup: 'paper key',
    desktop: 'device',
    mobile: 'device',
  }[type])

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  bannerBackgroundColor: undefined,
  bannerColor: undefined,
  bannerDesc: null, // TODO at some point
  currentDevice: stateProps.device.currentDevice,
  deviceID: stateProps.device.deviceID,
  icon: icon(stateProps.device.type),
  name: stateProps.device.name,
  onBack: dispatchProps.onBack,
  revokeName: revokeName(stateProps.device.type),
  revokedAt: stateProps.device.revokedAt,
  showRevokeDevicePage: dispatchProps.showRevokeDevicePage,
  timeline: buildTimeline(stateProps.device),
  type: stateProps.device.type,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(DevicePage)
