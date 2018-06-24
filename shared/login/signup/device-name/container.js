// @flow
import * as SignupGen from '../../../actions/signup-gen'
import DeviceName from '.'
import {connect, type TypedState} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  devicename: state.signup.devicename,
  error: state.signup.devicenameError,
})
const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onSubmit: (devicename: string) => dispatch(SignupGen.createSubmitDevicename({devicename})),
})

export default connect(mapStateToProps, mapDispatchToProps)(DeviceName)
