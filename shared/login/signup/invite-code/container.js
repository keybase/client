// @flow
import * as SignupGen from '../../../actions/signup-gen'
import InviteCode from '.'
import {connect, type TypedState} from '../../../util/container'
import {navigateAppend} from '../../../actions/route-tree'
import type {RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: TypedState) => ({
  error: state.signup.inviteCodeError,
  inviteCode: state.signup.inviteCode,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}: OwnProps) => ({
  onBack: () => dispatch(navigateUp()),
  onRequestInvite: () => dispatch(navigateAppend(['requestInvite'])),
  onSubmit: (inviteCode: string) => dispatch(SignupGen.createCheckInviteCode({inviteCode})),
})

export default connect(mapStateToProps, mapDispatchToProps)(InviteCode)
