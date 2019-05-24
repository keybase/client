import Error from '.'
import {connect} from '../../../util/container'
import * as SignupGen from '../../../actions/signup-gen'

type OwnProps = {}

const mapStateToProps = state => ({
  error: state.signup.signupError.stringValue(),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
})

// @ts-ignore codemode issue
const ConnectedSignupError = connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(Error)

// @ts-ignore
ConnectedSignupError.navigationOptions = {
  gesturesEnabled: false,
  headerLeft: null,
}

export default ConnectedSignupError
