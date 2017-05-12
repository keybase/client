// @flow
import DeviceRevoke from './'
import {compose, mapProps} from 'recompose'
import {connect} from 'react-redux'
import {isMobile} from '../../constants/platform'
import {navigateUp} from '../../actions/route-tree'
import {revoke} from '../../actions/devices'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  // $FlowIssue getIn
  device: state.entities.getIn(['devices', routeProps.deviceID]),
  endangeredTLFs: routeProps.endangeredTLFs,
})

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  onCancel: () => dispatch(navigateUp()),
  onSubmit: () => dispatch(revoke(routeProps.deviceID)),
})

const icon = props =>
  ({
    backup: isMobile ? 'icon-paper-key-revoke-64' : 'icon-paper-key-revoke-48',
    desktop: isMobile ? 'icon-computer-revoke-64' : 'icon-computer-revoke-48',
    mobile: isMobile ? 'icon-phone-revoke-64' : 'icon-phone-revoke-48',
  }[props.device.type])

const makeRenderProps = props => ({
  ...props,
  deviceID: props.device.deviceID,
  icon: icon(props),
  isCurrentDevice: props.device.currentDevice,
  name: props.device.name,
  type: props.device.type,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  mapProps(makeRenderProps)
)(DeviceRevoke)
