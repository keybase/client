// @flow
import InviteCode from './invite-code.render'
import {connect, type TypedState} from '../../util/container'
import {restartSignup, startRequestInvite, checkInviteCodeThenNextPhase} from '../../actions/signup'

export default connect(
  (state: TypedState) => ({
    inviteCode: state.signup.inviteCode,
    inviteCodeErrorText: state.signup.inviteCodeError,
    waiting: state.signup.waiting,
  }),
  (dispatch: Dispatch) => ({
    onBack: () => dispatch(restartSignup()),
    onInviteCodeSubmit: (inviteCode: string) => dispatch(checkInviteCodeThenNextPhase(inviteCode)),
    onRequestInvite: () => dispatch(startRequestInvite()),
  })
)(InviteCode)
