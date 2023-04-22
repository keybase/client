import * as SignupGen from '../../../actions/signup-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import RequestInviteSuccess from '.'
import * as Container from '../../../util/container'

export default () => {
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(SignupGen.createRestartSignup())
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {onBack}
  return <RequestInviteSuccess {...props} />
}
