import * as SignupGen from '../../../actions/signup-gen'
import {connect} from '../../../util/container'
import RequestInvite from '.'

type OwnProps = {}

const mapStateToProps = state => ({
  emailError: state.signup.emailError,
  nameError: state.signup.nameError,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  onSubmit: (email: string, name: string) => dispatch(SignupGen.createRequestInvite({email, name})),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(RequestInvite)
