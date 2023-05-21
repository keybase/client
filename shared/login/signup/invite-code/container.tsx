import * as SignupGen from '../../../actions/signup-gen'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import InviteCode from '.'

import type {PathParam} from '../../../constants/types/route-tree'
const a: PathParam = ['signupRequestInvite'] as const
console.log(a)

export default () => {
  const error = Container.useSelector(state => state.signup.inviteCodeError)
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(SignupGen.createGoBackAndClearErrors())
  }
  const onRequestInvite = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['signupRequestInvite']}))
  }
  const onSubmit = (inviteCode: string) => {
    dispatch(SignupGen.createCheckInviteCode({inviteCode}))
  }
  const props = {
    error,
    onBack,
    onRequestInvite,
    onSubmit,
  }
  return <InviteCode {...props} />
}
