import * as ProvisionGen from '../../actions/provision-gen'
import * as Constants from '../../constants/provision'
import SetPublicName from '.'
import * as Container from '../../util/container'
import * as LoginGen from '../../actions/login-gen'
import HiddenString from '../../util/hidden-string'

type OwnProps = {
  deviceName: string
  onChange: (text: string) => void
}

const mapStateToProps = (state: Container.TypedState) => ({
  _existingDevices: state.provision.existingDevices,
  configuredAccounts: state.config.configuredAccounts,
  error: state.provision.error.stringValue(),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onSubmit: (name: string) => dispatch(ProvisionGen.createSubmitDeviceName({name})),
  onLogIn: (username: string) => dispatch(LoginGen.createLogin({password: new HiddenString(''), username})),
})

export default Container.compose(
  Container.withStateHandlers<any, any, any>(
    {deviceName: ''},
    {onChange: () => (deviceName: string) => ({deviceName: Constants.cleanDeviceName(deviceName)})}
  ),
  Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps, ownProps: OwnProps) => {
    const submitEnabled = !!(ownProps.deviceName.length >= 3 && ownProps.deviceName.length <= 64)
    const onSubmit = submitEnabled ? () => dispatchProps._onSubmit(ownProps.deviceName) : null
    const loggedInAccounts = stateProps.configuredAccounts
      .filter(account => account.hasStoredSecret)
      .map(ac => ac.username)
    return {
      deviceName: ownProps.deviceName,
      error: stateProps.error,
      onBack: loggedInAccounts.size > 0 ? () => dispatchProps.onLogIn(loggedInAccounts.get(0) || '') : null,
      onChange: ownProps.onChange,
      onSubmit,
    }
  }),
  Container.safeSubmit(['onSubmit', 'onBack'], ['deviceName', 'error'])
  // @ts-ignore
)(SetPublicName)
