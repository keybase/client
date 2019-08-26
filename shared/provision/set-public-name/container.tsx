import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import SetPublicName from '.'
import * as Container from '../../util/container'
import * as LoginGen from '../../actions/login-gen'
import HiddenString from '../../util/hidden-string'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = {
  deviceName: string
  onChange: (text: string) => void
}

const mapStateToProps = (state: Container.TypedState) => ({
  _existingDevices: state.provision.existingDevices,
  configuredAccounts: state.config.configuredAccounts,
  error: state.provision.error.stringValue(),
  waiting: anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  _onSubmit: (name: string) => dispatch(ProvisionGen.createSubmitDeviceName({name})),
  onLogIn: (username: string) => dispatch(LoginGen.createLogin({password: new HiddenString(''), username})),
})

const ConnectedSetPublicName = Container.compose(
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
      onBack:
        loggedInAccounts.size > 0
          ? () => dispatchProps.onLogIn(loggedInAccounts.get(0) || '')
          : dispatchProps._onBack,
      onChange: ownProps.onChange,
      onSubmit,
      waiting: stateProps.waiting,
    }
  }),
  Container.safeSubmit(['onSubmit', 'onBack'], ['deviceName', 'error'])
  // @ts-ignore
)(SetPublicName)

ConnectedSetPublicName.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
}

export default ConnectedSetPublicName
