// @flow
import RenderSuccess from '../signup/success/index.render'
import {connect} from 'react-redux'
import HiddenString from '../../util/hidden-string'

import * as Creators from '../../actions/login/creators'
import type {TypedState} from '../../constants/reducer'

type OwnProps = {
  routeProps: {
    paperkey: HiddenString,
    title: string,
    waiting: boolean,
  },
}

// $FlowIssue
export default connect(
  (s: TypedState, {routeProps: {paperkey, title, waiting}}: OwnProps) => ({
    paperkey,
    title,
    waiting,
  }),
  (dispatch) => ({
    onFinish: () => dispatch(Creators.onFinish()),
    onBack: () => dispatch(Creators.onBack()),
  })
)(RenderSuccess)
