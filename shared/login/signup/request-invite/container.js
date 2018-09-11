// @flow
import * as SignupGen from '../../../actions/signup-gen'
import {connect, type TypedState} from '../../../util/container'
import RequestInvite from '.'

const mapStateToProps = (state: TypedState) => ({
  emailError: state.signup.emailError,
  usernameError: state.signup.nameError,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  onSubmit: (email: string, name: string) => dispatch(SignupGen.createRequestInvite({email, name})),
})
export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))(RequestInvite)
