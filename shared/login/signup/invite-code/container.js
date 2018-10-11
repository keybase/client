// @flow
import * as SignupGen from '../../../actions/signup-gen'
import InviteCode from '.'
import {connect, type TypedState} from '../../../util/container'
import {navigateAppend} from '../../../actions/route-tree'

const mapStateToProps = (state: TypedState) => ({
  error: state.signup.inviteCodeError,
  inviteCode: state.signup.inviteCode,
})

const mapDispatchToProps = (dispatch) => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  onRequestInvite: () => dispatch(navigateAppend(['requestInvite'])),
  onSubmit: (inviteCode: string) => dispatch(SignupGen.createCheckInviteCode({inviteCode})),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(InviteCode)
