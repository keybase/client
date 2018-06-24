// @flow
import * as SignupGen from '../../../actions/signup-gen'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import UsernameEmail from '.'

const mapStateToProps = (state: TypedState) => ({
  emailError: state.signup.emailError,
  usernameError: state.signup.usernameError,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(SignupGen.createRestartSignup()),
  onSubmit: (username: string, email: string) =>
    dispatch(SignupGen.createCheckUsernameEmail({email, username})),
})

export default connect(mapStateToProps, mapDispatchToProps)(UsernameEmail)
