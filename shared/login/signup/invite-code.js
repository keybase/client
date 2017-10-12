// @flow
import InviteCode from './invite-code.render'
import {connect, type TypedState} from '../../util/container'
import {restartSignup, checkInviteCode, startRequestInvite} from '../../actions/signup'

export default connect(
  (state: TypedState) => ({
    inviteCode: state.signup.inviteCode,
    inviteCodeErrorText: state.signup.inviteCodeError,
    waiting: state.signup.waiting,
  }),
  (dispatch: Dispatch) => ({
    onBack: () => dispatch(restartSignup()),
    onInviteCodeSubmit: (code: string) => dispatch(checkInviteCode(code)),
    onRequestInvite: () => dispatch(startRequestInvite()),
  })
)(InviteCode)
