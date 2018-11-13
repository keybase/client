// @flow
import * as SignupGen from '../../../actions/signup-gen'
import {connect} from '../../../util/container'
import UsernameEmail from '.'

type OwnProps = {||}

const mapStateToProps = state => ({
  email: state.signup.email,
  emailError: state.signup.emailError,
  username: state.signup.username,
  usernameError: state.signup.usernameError,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(SignupGen.createRestartSignup()),
  onSubmit: (username: string, email: string) =>
    dispatch(SignupGen.createCheckUsernameEmail({email, username})),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(UsernameEmail)
