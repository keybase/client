// @flow
import * as SignupGen from '../../../actions/signup-gen'
import InviteCode from '.'
import {connect, type TypedState} from '../../../util/container'
import {navigateAppend} from '../../../actions/route-tree'

const mapStateToProps = (state: TypedState) => ({
  inviteCode: state.signup.inviteCode,
  inviteCodeErrorText: state.signup.inviteCodeError,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(SignupGen.createRestartSignup()),
  onRequestInvite: () => dispatch(navigateAppend(['requestInvite'])),
  onSubmit: (inviteCode: string) => dispatch(SignupGen.createCheckInviteCode({inviteCode})),
})

export default connect(mapStateToProps, mapDispatchToProps)(InviteCode)
