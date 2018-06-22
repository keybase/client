// @flow
import Error from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import * as SignupGen from '../../../actions/signup-gen'

const mapStateToProps = (state: TypedState) => ({errorText: state.signup.signupError})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  restartSignup: () => dispatch(SignupGen.createRestartSignup()),
})

export default connect(mapStateToProps, mapDispatchToProps)(Error)
