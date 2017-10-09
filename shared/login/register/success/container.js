// @flow
import * as Creators from '../../../actions/login/creators'
import HiddenString from '../../../util/hidden-string'
import RenderSuccess from '../../signup/success/index.render'
import {connect, type TypedState} from '../../../util/container'
import {type RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<
  {
    paperkey: HiddenString,
    title: string,
    waiting: boolean,
  },
  {}
>

const mapStateToProps = (s: TypedState, {routeProps}: OwnProps) => ({
  paperkey: routeProps.get('paperkey'),
  title: routeProps.get('title'),
  waiting: routeProps.get('waiting'),
})

const mapDispatchToProps = dispatch => ({
  onFinish: () => dispatch(Creators.onFinish()),
  onBack: () => dispatch(Creators.onBack()),
})

export default connect(mapStateToProps, mapDispatchToProps)(RenderSuccess)
