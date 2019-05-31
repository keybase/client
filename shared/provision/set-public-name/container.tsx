import * as ProvisionGen from '../../actions/provision-gen'
import * as Constants from '../../constants/provision'
import SetPublicName from '.'
import {connect, withStateHandlers, compose, safeSubmit} from '../../util/container'
import {RouteProps} from '../../route-tree/render-route'

type OwnProps = {
  deviceName: string
  onChange: (text: string) => void
} & RouteProps<{}, {}>

const mapStateToProps = state => ({
  _existingDevices: state.provision.existingDevices,
  error: state.provision.error.stringValue(),
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  _onSubmit: (name: string) => dispatch(ProvisionGen.createSubmitDeviceName({name})),
  // TODO remove
  onBack: () => {},
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const submitEnabled = !!(ownProps.deviceName.length >= 3 && ownProps.deviceName.length <= 64)
  const onSubmit = submitEnabled ? () => dispatchProps._onSubmit(ownProps.deviceName) : null
  return {
    deviceName: ownProps.deviceName,
    error: stateProps.error,
    onBack: dispatchProps.onBack,
    onChange: ownProps.onChange,
    onSubmit,
  }
}

export default compose(
  withStateHandlers<any, any, any>(
    {deviceName: ''},
    {
      onChange: () => (deviceName: string) => ({deviceName: Constants.cleanDeviceName(deviceName)}),
    }
  ),
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  safeSubmit(['onSubmit', 'onBack'], ['deviceName', 'error'])
  // @ts-ignore
)(SetPublicName)
