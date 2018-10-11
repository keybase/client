// @flow
import * as SignupGen from '../../../actions/signup-gen'
import {connect, type TypedState} from '../../../util/container'
import UsernameEmail from '.'

const mapStateToProps = (state: TypedState) => ({
  email: state.signup.email,
  emailError: state.signup.emailError,
  username: state.signup.username,
  usernameError: state.signup.usernameError,
})

const mapDispatchToProps = (dispatch) => ({
  onBack: () => dispatch(SignupGen.createRestartSignup()),
  onSubmit: (username: string, email: string) =>
    dispatch(SignupGen.createCheckUsernameEmail({email, username})),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(UsernameEmail)
