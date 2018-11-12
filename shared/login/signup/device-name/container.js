// @flow
import * as SignupGen from '../../../actions/signup-gen'
import DeviceName from '.'
import {connect} from '../../../util/container'

type OwnProps = {||}

const mapStateToProps = state => ({
  devicename: state.signup.devicename,
  error: state.signup.devicenameError,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  onSubmit: (devicename: string) => dispatch(SignupGen.createCheckDevicename({devicename})),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(DeviceName)
