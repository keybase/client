// @flow
import * as SignupGen from '../../actions/signup-gen'
import {compose, connect, withStateHandlers, withHandlers} from '../../util/container'
import UsernameEmail from '.'

type OwnProps = {||}

const mapStateToProps = state => ({
  email: state.signup.email,
  emailError: state.signup.emailError,
  username: state.signup.username,
  usernameError: state.signup.usernameError,
  usernameTaken: state.signup.usernameTaken && state.signup.username,
})

const mapDispatchToProps = dispatch => ({
  _onSubmit: (username: string) => dispatch(SignupGen.createCheckUsername({username})),
  onBack: () => dispatch(SignupGen.createRestartSignup()),
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  withStateHandlers({username: ''}, {onChangeUsername: () => username => ({username})}),
  withHandlers({
    onContinue: ({_onSubmit, username}) => () => {
      _onSubmit(username)
    },
  })
)(UsernameEmail)
