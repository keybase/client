// @flow
import Error from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import * as SignupGen from '../../../actions/signup-gen'

const mapStateToProps = (state: TypedState) => ({
  error: state.signup.signupError.stringValue(),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  onRestart: () => dispatch(SignupGen.createRestartSignup()),
})

export default connect(mapStateToProps, mapDispatchToProps)(Error)
