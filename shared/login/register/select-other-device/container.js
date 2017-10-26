// @flow
import * as Creators from '../../../actions/login/creators'
import SelectOtherDevice from '.'
import {connect, type TypedState} from '../../../util/container'
import {type Device} from '../../../constants/types/more'
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
  onBack: () => dispatch(Creators.onBack()),
  onWont: () => dispatch(Creators.onWont()),
  onSelect: deviceId => dispatch(Creators.selectDeviceId(deviceId)),
})

export default connect(mapStateToProps, mapDispatchToProps)(SelectOtherDevice)
