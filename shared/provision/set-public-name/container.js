// @flow
// TODO merge desktop and native views
import * as ProvisionGen from '../../actions/provision-gen'
import * as Constants from '../../constants/provision'
import SetPublicName from '.'
import {connect, type TypedState, withStateHandlers, compose, safeSubmit} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = {deviceName: string, onChange: (text: string) => void} & RouteProps<{}, {}>

const mapStateToProps = (state: TypedState) => ({
  _existingDevices: state.provision.existingDevices,
  error: state.provision.error.stringValue(),
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  _onSubmit: (name: string) => dispatch(ProvisionGen.createSubmitDeviceName({name})),
  onBack: () => dispatch(ownProps.navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const nameTaken = stateProps._existingDevices.indexOf(ownProps.deviceName) !== -1
  const submitEnabled = !!(ownProps.deviceName.length >= 3 && ownProps.deviceName.length <= 64 && !nameTaken)
  const onSubmit = submitEnabled ? () => dispatchProps._onSubmit(ownProps.deviceName) : null
  return {
    deviceName: ownProps.deviceName,
    error: stateProps.error,
    existingDevices: stateProps._existingDevices,
    onBack: dispatchProps.onBack,
    onChange: ownProps.onChange,
    onSubmit,
  }
}

export default compose(
  withStateHandlers(
    {deviceName: '', submitEnabled: false},
    {
      onChange: () => (deviceName: string) => ({deviceName: Constants.cleanDeviceName(deviceName)}),
    }
  ),
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  safeSubmit(['onSubmit', 'onBack'], ['error'])
)(SetPublicName)
