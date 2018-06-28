// @flow
import Error from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import * as SignupGen from '../../../actions/signup-gen'
import type {RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: TypedState) => ({
  error: state.signup.signupError.stringValue(),
})
const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}: OwnProps) => ({
  onBack: () => dispatch(navigateUp()),
  onRestart: () => dispatch(SignupGen.createRestartSignup()),
})

export default connect(mapStateToProps, mapDispatchToProps)(Error)
