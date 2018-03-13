// @flow
import RenderSuccess from './index.render'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import {sawPaperKey} from '../../../actions/signup'
import {navigateUp} from '../../../actions/route-tree'
import {type RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<
  {
    title?: ?string,
  },
  {}
>

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => ({
  paperkey: state.signup.paperkey,
  waiting: state.signup.waiting,
  ...routeProps.toObject(),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onFinish: () => dispatch(sawPaperKey()),
  onBack: () => dispatch(navigateUp()),
})

export default connect(mapStateToProps, mapDispatchToProps)(RenderSuccess)
