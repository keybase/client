// @flow
import DevicePage from '.'
import moment from 'moment'
import {compose, mapProps, connect, type TypedState} from '../../util/container'
import {globalColors} from '../../styles'
import {navigateUp} from '../../actions/route-tree'
import {showRevokePage} from '../../actions/devices'
import {type DeviceDetail} from '../../constants/devices'

const buildTimeline = (device: DeviceDetail) => {
  const revoked = device.get('revokedAt') && [
    {
      desc: `Revoked ${moment(device.get('revokedAt')).format('MMM D, YYYY')}`,
      subDesc: device.getIn(['revokedBy', 'name'], ''),
      type: 'Revoked',
    },
  ]

  const lastUsed = device.lastUsed && [
    {
      desc: `Last used ${moment(device.get('lastUsed')).format('MMM D, YYYY')}`,
      subDesc: moment(device.get('lastUsed')).fromNow(),
      type: 'LastUsed',
    },
  ]

  const provisioner = device.get('provisioner')
  const added = {
    desc: `Added ${moment(device.get('created')).format('MMM D, YYYY')}`,
    subDesc: (provisioner && provisioner.name) || '',
    type: 'Added',
  }

  return [...(revoked || []), ...(lastUsed || []), added]
}

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  device: state.entities.getIn(['devices', routeProps.get('deviceID')]),
})

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  onBack: () => dispatch(navigateUp()),
  showRevokeDevicePage: () => dispatch(showRevokePage(routeProps.get('deviceID'))),
})

const bannerColor = props =>
  ({
    OutOfDate: globalColors.brown_60,
    WillUnlock: globalColors.white,
  }[props.device.type])

const bannerBackgroundColor = props =>
  ({
    OutOfDate: globalColors.yellow,
    WillUnlock: globalColors.blue,
  }[props.device.type])

const icon = props =>
  ({
    backup: 'icon-paper-key-64',
    desktop: 'icon-computer-64',
    mobile: 'icon-phone-64',
  }[props.device.type])

const revokeName = props =>
  ({
    backup: 'paper key',
    desktop: 'device',
    mobile: 'device',
  }[props.device.type])

const makeRenderProps = props => ({
  ...props,
  bannerBackgroundColor: bannerBackgroundColor(props),
  bannerColor: bannerColor(props),
  bannerDesc: null, // TODO at some point
  currentDevice: props.device.currentDevice,
  device: props.device,
  deviceID: props.device.deviceID,
  icon: icon(props),
  name: props.device.name,
  revokeName: revokeName(props),
  revokedAt: props.device.revokedAt,
  timeline: buildTimeline(props.device),
  type: props.device.type,
})

export default compose(connect(mapStateToProps, mapDispatchToProps), mapProps(makeRenderProps))(DevicePage)
