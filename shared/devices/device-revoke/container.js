// @flow
import DeviceRevoke from './'
import {compose, mapProps, connect, type TypedState} from '../../util/container'
import {isMobile} from '../../constants/platform'
import {navigateUp} from '../../actions/route-tree'
import {createRevoke} from '../../actions/devices-gen'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  device: state.entities.getIn(['devices', routeProps.get('deviceID')]),
  endangeredTLFs: routeProps.get('endangeredTLFs'),
})

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  onCancel: () => dispatch(navigateUp()),
  onSubmit: () => dispatch(createRevoke({deviceID: routeProps.get('deviceID')})),
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

export default compose(connect(mapStateToProps, mapDispatchToProps), mapProps(makeRenderProps))(DeviceRevoke)
