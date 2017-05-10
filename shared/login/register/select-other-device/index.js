// @flow
import RenderSelectOtherDevice from './index.render'
import * as Creators from '../../../actions/login/creators'
import {connect} from 'react-redux'

import type {TypedState} from '../../../constants/reducer'
import type {Device} from '../../../constants/types/more'

type OwnProps = {
  routeProps: {
    devices: Array<Device>,
  },
}

// $FlowIssue
export default connect(
  (s: TypedState, {routeProps: {devices}}: OwnProps) => ({devices}),
  dispatch => ({
    onBack: () => dispatch(Creators.onBack()),
    onWont: () => dispatch(Creators.onWont()),
    onSelect: deviceId => dispatch(Creators.selectDeviceId(deviceId)),
  })
)(RenderSelectOtherDevice)
