// @flow
import InviteCode from './invite-code.render'
import {connect} from 'react-redux'
import {
  restartSignup,
  checkInviteCode,
  startRequestInvite,
} from '../../actions/signup'

import type {TypedState} from '../../constants/reducer'

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
