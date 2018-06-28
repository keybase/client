// @flow
import * as SignupGen from '../../../actions/signup-gen'
import DeviceName from '.'
import {connect, type TypedState} from '../../../util/container'
import type {RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: TypedState) => ({
  devicename: state.signup.devicename,
  error: state.signup.devicenameError,
})
const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}: OwnProps) => ({
  onBack: () => dispatch(navigateUp()),
  onSubmit: (devicename: string) => dispatch(SignupGen.createCheckDevicename({devicename})),
})

export default connect(mapStateToProps, mapDispatchToProps)(DeviceName)
