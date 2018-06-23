// @flow
import * as SignupGen from '../../../actions/signup-gen'
import * as Constants from '../../../constants/signup'
import InviteCode from '.'
import {connect, type TypedState} from '../../../util/container'
import {startRequestInvite, checkInviteCodeThenNextPhase} from '../../../actions/signup'

const mapStateToProps = (state: TypedState) => ({
  inviteCode: state.signup.inviteCode,
  inviteCodeErrorText: state.signup.inviteCodeError,
  waiting: !!state.waiting.get(Constants.waitingKey),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(SignupGen.createRestartSignup()),
  onInviteCodeSubmit: (inviteCode: string) => dispatch(checkInviteCodeThenNextPhase(inviteCode)),
  onRequestInvite: () => dispatch(startRequestInvite()),
})

export default connect(mapStateToProps, mapDispatchToProps)(InviteCode)
