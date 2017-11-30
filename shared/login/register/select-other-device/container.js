// @flow
import * as LoginGen from '../../../actions/login-gen'
import SelectOtherDevice from '.'
import {connect, type TypedState} from '../../../util/container'
import {compose, withState} from 'recompose'
import {type Device} from '../../../constants/types/devices'
import {type RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<
  {
    devices: Array<Device>,
    canSelectNoDevice: boolean,
  },
  {}
>

const mapStateToProps = (s: TypedState, {routeProps}: OwnProps) => ({
  devices: routeProps.get('devices'),
  canSelectNoDevice: routeProps.get('canSelectNoDevice'),
})
const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(LoginGen.createOnBack()),
  onWont: () => dispatch(LoginGen.createOnWont()),
  onSelect: deviceId => dispatch(LoginGen.createSelectDeviceId({deviceId})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('showResetLink', 'setShowResetLink', false)
)(SelectOtherDevice)
