// @flow
// TODO merge desktop and native views
import * as LoginGen from '../../../actions/login-gen'
import * as Constants from '../../../constants/login'
import SetPublicName from '.'
import {connect, type TypedState, withStateHandlers, compose} from '../../../util/container'
import {type RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<{deviceName: string}, {}>

const mapStateToProps = (state: TypedState) => ({
  _existingDevices: state.login.provisionExistingDevices.toArray(),
  deviceNameError: state.login.error,
  waiting: !!state.waiting.get(Constants.waitingKey),
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  _onSubmit: (name: string) => dispatch(LoginGen.createSubmitProvisionDeviceName({name})),
  onBack: () => dispatch(ownProps.navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const nameTaken = stateProps._existingDevices.indexOf(ownProps.deviceName) !== -1
  const submitEnabled = !!(ownProps.deviceName.length >= 3 && ownProps.deviceName.length <= 64 && !nameTaken)
  const onSubmit = submitEnabled ? () => dispatchProps._onSubmit(ownProps.deviceName) : null
  return {
    deviceNameError: stateProps.deviceNameError,
    existingDevices: stateProps._existingDevices,
    onBack: dispatchProps.onBack,
    onSubmit,
    waiting: stateProps.waiting,
  }
}

export default compose(
  withStateHandlers(
    {deviceName: '', submitEnabled: false},
    {
      onChange: () => (deviceName: string) => ({deviceName: Constants.cleanDeviceName(deviceName)}),
    }
  ),
  connect(mapStateToProps, mapDispatchToProps, mergeProps)
)(SetPublicName)
