// @flow
import * as ConfigGen from '../../actions/config-gen'
import * as SignupGen from '../../actions/signup-gen'
import DeviceName from '.'
import {compose, connect, withStateHandlers, withHandlers} from '../../util/container'

type OwnProps = {||}

const mapStateToProps = state => ({
  email: state.signup.email,
  error: state.signup.emailError,
})

const mapDispatchToProps = dispatch => ({
  _onSubmit: (allowSearch: boolean, email: string) => dispatch(SignupGen.createCheckEmail({email})),
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  onSkip: () => dispatch(ConfigGen.createLoggedIn({causedByStartup: false})),
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  withStateHandlers(
    {allowSearch: false, email: ''},
    {onChangeAllowSearch: () => allowSearch => ({allowSearch}), onChangeEmail: () => email => ({email})}
  ),
  withHandlers({
    onFinish: ({_onSubmit, allowSearch, email}) => () => {
      _onSubmit(allowSearch, email)
    },
  })
)(DeviceName)
