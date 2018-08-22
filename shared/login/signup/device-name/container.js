// @flow
import * as SignupGen from '../../../actions/signup-gen'
import DeviceName from '.'
import {connect, type TypedState} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  devicename: state.signup.devicename,
  error: state.signup.devicenameError,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  onSubmit: (devicename: string) => dispatch(SignupGen.createCheckDevicename({devicename})),
})

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))(DeviceName)
