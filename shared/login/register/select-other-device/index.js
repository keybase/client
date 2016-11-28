// @flow
import RenderSelectOtherDevice from './index.render'
import {connect} from 'react-redux'

import type {TypedState} from '../../../constants/reducer'

export default connect(
  (state: TypedState, {routeProps}) => routeProps,
)(RenderSelectOtherDevice)
