// @flow
import Error from '.'
import {connect} from '../../../util/container'
import * as SignupGen from '../../../actions/signup-gen'

type OwnProps = {||}

const mapStateToProps = state => ({
  error: state.signup.signupError.stringValue(),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
})

const ConnectedSignupError = connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(Error)

// $FlowIssue lets fix this
ConnectedSignupError.navigationOptions = {
  gesturesEnabled: false,
  headerLeft: null,
}

export default ConnectedSignupError
