// @flow
import * as Constants from '../../constants/devices'
import DeviceRevoke from './'
import {connect, type TypedState} from '../../util/container'
import {isMobile} from '../../constants/platform'
import {navigateUp} from '../../actions/route-tree'
import {createRevoke} from '../../actions/devices-gen'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  device: state.entities.getIn(['devices', routeProps.get('deviceID')], Constants.makeDeviceDetail()),
  endangeredTLFs: routeProps.get('endangeredTLFs'),
})

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  onCancel: () => dispatch(navigateUp()),
  onSubmit: () => dispatch(createRevoke({deviceID: routeProps.get('deviceID')})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  currentDevice: stateProps.device.currentDevice,
  deviceID: stateProps.device.deviceID,
  endangeredTLFs: stateProps.endangeredTLFs,
  icon: icon(stateProps.device.type),
  name: stateProps.device.name,
  onCancel: dispatchProps.onCancel,
  onSubmit: dispatchProps.onSubmit,
})

const icon = type =>
  ({
    backup: isMobile ? 'icon-paper-key-revoke-64' : 'icon-paper-key-revoke-48',
    desktop: isMobile ? 'icon-computer-revoke-64' : 'icon-computer-revoke-48',
    mobile: isMobile ? 'icon-phone-revoke-64' : 'icon-phone-revoke-48',
  }[type])

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(DeviceRevoke)
