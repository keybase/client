// @flow
import DeviceRevoke from './'
import {connect} from 'react-redux'
import {compose, mapProps} from 'recompose'
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

const makeRenderProps = props => ({
  ...props,
  deviceID: props.device.deviceID,
  isCurrentDevice: props.device.currentDevice,
  name: props.device.name,
  type: props.device.type,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  mapProps(makeRenderProps),
)(DeviceRevoke)
