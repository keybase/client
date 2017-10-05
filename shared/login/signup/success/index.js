// @flow
import RenderSuccess from './index.render'
import {connect, type TypedState} from '../../../util/container'
import {sawPaperKey} from '../../../actions/signup'
import {navigateUp} from '../../../actions/route-tree'

type OwnProps = {
  routeProps: {
    title?: ?string,
  },
}

export default connect(
  (state: TypedState, {routeProps}: OwnProps) => ({
    paperkey: state.signup.paperkey,
    waiting: state.signup.waiting,
    ...routeProps,
  }),
  dispatch => ({
    onFinish: () => dispatch(sawPaperKey()),
    onBack: () => dispatch(navigateUp()),
  })
)(RenderSuccess)
