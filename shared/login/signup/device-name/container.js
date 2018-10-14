// @flow
import * as SignupGen from '../../../actions/signup-gen'
import DeviceName from '.'
import {connect} from '../../../util/container'

const mapStateToProps = state => ({
  devicename: state.signup.devicename,
  error: state.signup.devicenameError,
})

const mapDispatchToProps = (dispatch) => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  onSubmit: (devicename: string) => dispatch(SignupGen.createCheckDevicename({devicename})),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(DeviceName)
