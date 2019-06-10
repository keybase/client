import * as SignupGen from '../../../actions/signup-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {connect} from '../../../util/container'
import UsernameEmail from '.'

type OwnProps = {}

const mapStateToProps = state => ({
  email: state.signup.email,
  emailError: state.signup.emailError,
  username: state.signup.username,
  usernameError: state.signup.usernameError,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => {
    dispatch(SignupGen.createRestartSignup())
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onSubmit: (username: string, email: string) =>
    dispatch(SignupGen.createCheckUsernameEmail({email, username})),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(UsernameEmail)
