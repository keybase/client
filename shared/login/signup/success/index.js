// @flow
import RenderSuccess from './index.render'
import {connect, type TypedState} from '../../../util/container'
import {sawPaperKey} from '../../../actions/signup'
import {navigateUp} from '../../../actions/route-tree'
import {type RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<
  {
    title?: ?string,
  },
  {}
>

export default connect(
  (state: TypedState, {routeProps}: OwnProps) => ({
    paperkey: state.signup.paperkey,
    waiting: state.signup.waiting,
    ...routeProps.toObject(),
  }),
  dispatch => ({
    onFinish: () => dispatch(sawPaperKey()),
    onBack: () => dispatch(navigateUp()),
  })
)(RenderSuccess)
