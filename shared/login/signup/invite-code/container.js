// @flow
import InviteCode from '.'
import {connect, type TypedState} from '../../../util/container'
import {restartSignup, startRequestInvite, checkInviteCodeThenNextPhase} from '../../../actions/signup'

const mapStateToProps = (state: TypedState) => ({
  inviteCode: state.signup.inviteCode,
  inviteCodeErrorText: state.signup.inviteCodeError,
  waiting: state.signup.waiting,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(restartSignup()),
  onInviteCodeSubmit: (inviteCode: string) => dispatch(checkInviteCodeThenNextPhase(inviteCode)),
  onRequestInvite: () => dispatch(startRequestInvite()),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(InviteCode)
