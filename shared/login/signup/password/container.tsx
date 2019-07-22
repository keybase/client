import * as SignupGen from '../../../actions/signup-gen'
import {connect} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'
import Password from '.'

type OwnProps = {}

const mapStateToProps = state => ({
  error: state.signup.passwordError.stringValue(),
  password: state.signup.password.stringValue(),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  onSubmit: (pass1: string, pass2: string) =>
    dispatch(SignupGen.createCheckPassword({pass1: new HiddenString(pass1), pass2: new HiddenString(pass2)})),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
    (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(Password)
