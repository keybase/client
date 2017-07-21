// @flow
import RenderSuccess from './index.render'
import {connect} from 'react-redux-profiled'
import {sawPaperKey} from '../../../actions/signup'
import {navigateUp} from '../../../actions/route-tree'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  routeProps: {
    title?: ?string,
  },
}

// $FlowIssue with connect
export default connect(
  (state: TypedState, {routeProps}: OwnProps) => ({
    paperkey: state.signup.paperkey,
    waiting: state.signup.waiting,
    ...routeProps,
  }),
  dispatch => ({
    onFinish: () => {
      dispatch(sawPaperKey())
    },
    onBack: () => {
      dispatch(navigateUp())
    },
  })
)(RenderSuccess)
