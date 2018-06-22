// @flow
import * as SignupGen from '../../../actions/signup-gen'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import UsernameEmail from '.'

const mapStateToProps = (state: TypedState) => ({
  emailErrorText: state.signup.emailError && state.signup.emailError.message,
  usernameErrorText: state.signup.usernameError && state.signup.usernameError.message,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(SignupGen.createRestartSignup()),
  onSubmit: (username: string, email: string) =>
    dispatch(SignupGen.createCheckUsernameEmail({email, username})),
})

export default connect(mapStateToProps, mapDispatchToProps)(UsernameEmail)
