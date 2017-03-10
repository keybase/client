// @flow
import DevicePage from '.'
import moment from 'moment'
import {connect} from 'react-redux'
import {compose, mapProps} from 'recompose'
import {navigateUp} from '../../actions/route-tree'
import {showRevokePage} from '../../actions/devices'

import type {DeviceDetail} from '../../constants/devices'
import type {TypedState} from '../../constants/reducer'

const buildTimeline = (device: DeviceDetail) => {
  const added = moment(device.get('created'))
  const timeline = []
  if (device.revokedAt) {
    const revoked = moment(device.revokedAt)
    timeline.push({
      desc: 'Revoked ' + revoked.format('MMM D, YYYY'),
    // $FlowIssue getIn
      subDesc: device.getIn(['revokedBy', 'name'], ''),
      type: 'Revoked',
    })
  } else if (device.lastUsed) {
    const lastUsed = moment(device.lastUsed)
    timeline.push({
      desc: 'Last used ' + lastUsed.format('MMM D, YYYY'),
      subDesc: lastUsed.fromNow(),
      type: 'LastUsed',
    })
  }
  timeline.push({
    desc: 'Added ' + added.format('MMM D, YYYY'),
    // $FlowIssue getIn
    subDesc: device.getIn(['provisioner', 'name'], ''),
    type: 'Added',
  })
  return timeline
}

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  // $FlowIssue getIn
  device: state.entities.getIn(['devices', routeProps.deviceID]),
})

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  onBack: () => dispatch(navigateUp()),
  showRevokeDevicePage: () => dispatch(showRevokePage(routeProps.deviceID)),
})

const makeRenderProps = props => ({
  ...props,
  currentDevice: props.device.currentDevice,
  device: props.device,
  deviceID: props.device.deviceID,
  name: props.device.name,
  revokedAt: props.device.revokedAt,
  timeline: buildTimeline(props.device),
  type: props.device.type,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  mapProps(makeRenderProps),
)(DevicePage)
