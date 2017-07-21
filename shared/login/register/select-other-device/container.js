// @flow
import SelectOtherDevice from '.'
import * as Creators from '../../../actions/login/creators'
import {connect} from 'react-redux-profiled'

import type {TypedState} from '../../../constants/reducer'
import type {Device} from '../../../constants/types/more'

type OwnProps = {
  routeProps: {
    devices: Array<Device>,
  },
}

const mapStateToProps = (s: TypedState, {routeProps: {devices}}: OwnProps) => ({devices})
const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(Creators.onBack()),
  onWont: () => dispatch(Creators.onWont()),
  onSelect: deviceId => dispatch(Creators.selectDeviceId(deviceId)),
})

// $FlowIssue
export default connect(mapStateToProps, mapDispatchToProps)(SelectOtherDevice)
