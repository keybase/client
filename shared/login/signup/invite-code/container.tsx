import * as SignupGen from '../../../actions/signup-gen'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import InviteCode from '.'

type OwnProps = {}

export default Container.connect(
  state => ({
    error: state.signup.inviteCodeError,
  }),
  dispatch => ({
    onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
    onRequestInvite: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['requestInvite']})),
    onSubmit: (inviteCode: string) => dispatch(SignupGen.createCheckInviteCode({inviteCode})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(InviteCode)
