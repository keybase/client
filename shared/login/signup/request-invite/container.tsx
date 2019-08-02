import * as SignupGen from '../../../actions/signup-gen'
import {connect} from '../../../util/container'
import RequestInvite from '.'

type OwnProps = {}

export default connect(
  state => ({
    emailError: state.signup.emailError,
    nameError: state.signup.nameError,
  }),
  dispatch => ({
    onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
    onSubmit: (email: string, name: string) => dispatch(SignupGen.createRequestInvite({email, name})),
  }),
  (s, d, _: OwnProps) => ({...s, ...d})
)(RequestInvite)
