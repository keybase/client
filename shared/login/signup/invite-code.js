// @flow
import InviteCode from './invite-code.render'
import {connect, type TypedState} from '../../util/container'
import {restartSignup, startRequestInvite} from '../../actions/signup'
import {createCheckInviteCode} from '../../actions/signup-gen'

export default connect(
  (state: TypedState) => ({
    inviteCode: state.signup.inviteCode,
    inviteCodeErrorText: state.signup.inviteCodeError,
    waiting: state.signup.waiting,
  }),
  (dispatch: Dispatch) => ({
    onBack: () => dispatch(restartSignup()),
    onInviteCodeSubmit: (inviteCode: string) => dispatch(createCheckInviteCode({inviteCode})),
    onRequestInvite: () => dispatch(startRequestInvite()),
  })
)(InviteCode)
