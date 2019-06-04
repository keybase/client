import * as SignupGen from '../../../actions/signup-gen'
import InviteCode from '.'
import {connect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type OwnProps = {}

const mapStateToProps = state => ({
  error: state.signup.inviteCodeError,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  onRequestInvite: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['requestInvite']})),
  onSubmit: (inviteCode: string) => dispatch(SignupGen.createCheckInviteCode({inviteCode})),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(InviteCode)
