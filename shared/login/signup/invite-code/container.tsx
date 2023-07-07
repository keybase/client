import * as Container from '../../../util/container'
import * as Constants from '../../../constants/signup'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import InviteCode from '.'

export default () => {
  const error = Constants.useState(s => s.inviteCodeError)
  const dispatch = Container.useDispatch()
  const goBackAndClearErrors = Constants.useState(s => s.dispatch.goBackAndClearErrors)
  const checkInviteCode = Constants.useState(s => s.dispatch.checkInviteCode)
  const onBack = goBackAndClearErrors
  const onRequestInvite = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['signupRequestInvite']}))
  }
  const onSubmit = checkInviteCode
  const props = {
    error,
    onBack,
    onRequestInvite,
    onSubmit,
  }
  return <InviteCode {...props} />
}
