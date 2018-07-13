// @flow
// TODO merge desktop and native views
import * as ProvisionGen from '../../../actions/provision-gen'
import * as Constants from '../../../constants/provision'
import SetPublicName from '.'
import {connect, type TypedState, withStateHandlers, compose} from '../../../util/container'
import {type RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<{deviceName: string}, {}>

const mapStateToProps = (state: TypedState) => ({
  _existingDevices: state.provision.existingDevices.toArray(),
  deviceNameError: state.provision.error,
  waiting: !!state.waiting.get(Constants.waitingKey),
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  _onSubmit: (name: string) => dispatch(ProvisionGen.createSubmitProvisionDeviceName({name})),
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
