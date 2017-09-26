// @flow
import SelectOtherDevice from '.'
import * as Creators from '../../../actions/login/creators'
import {connect} from 'react-redux'

import type {TypedState} from '../../../constants/reducer'
import type {Device} from '../../../constants/types/more'

// type OwnProps = {
// routeProps: {
// devices: Array<Device>,
// canSelectNoDevice: boolean,
// },
// }

const mapStateToProps = (s: TypedState, {routeProps}) => ({
  devices: routeProps.get('devices'),
  canSelectNoDevice: routeProps.get('canSelectNoDevice'),
})
const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(Creators.onBack()),
  onWont: () => dispatch(Creators.onWont()),
  onSelect: deviceId => dispatch(Creators.selectDeviceId(deviceId)),
})

// $FlowIssue
export default connect(mapStateToProps, mapDispatchToProps)(SelectOtherDevice)
