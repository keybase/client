import * as RouteTreeGen from '../../../actions/route-tree-gen'
import RequestInviteSuccess from '.'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/signup'

export default () => {
  const dispatch = Container.useDispatch()
  const restartSignup = Constants.useState(s => s.dispatch.restartSignup)
  const onBack = () => {
    restartSignup()
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {onBack}
  return <RequestInviteSuccess {...props} />
}
