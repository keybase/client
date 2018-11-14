// @flow
import * as SignupGen from '../../../actions/signup-gen'
import InviteCode from '.'
import {connect} from '../../../util/container'
import {navigateAppend} from '../../../actions/route-tree'

type OwnProps = {||}

const mapStateToProps = state => ({
  error: state.signup.inviteCodeError,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  onRequestInvite: () => dispatch(navigateAppend(['requestInvite'])),
  onSubmit: (inviteCode: string) => dispatch(SignupGen.createCheckInviteCode({inviteCode})),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(InviteCode)
