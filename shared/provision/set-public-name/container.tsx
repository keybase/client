import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import SetPublicName from '.'
import * as Container from '../../util/container'
import * as LoginGen from '../../actions/login-gen'
import HiddenString from '../../util/hidden-string'

const mapStateToProps = (state: Container.TypedState) => ({
  _existingDevices: state.provision.existingDevices,
  configuredAccounts: state.config.configuredAccounts,
  error: state.provision.error.stringValue(),
  waiting: Container.anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onLogIn: (username: string) => dispatch(LoginGen.createLogin({password: new HiddenString(''), username})),
  onSubmit: (name: string) => dispatch(ProvisionGen.createSubmitDeviceName({name})),
})

export default Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps) => {
  const loggedInAccounts = stateProps.configuredAccounts
    .filter(account => account.hasStoredSecret)
    .map(ac => ac.username)
  return {
    error: stateProps.error,
    onBack:
      loggedInAccounts.size > 0
        ? () => dispatchProps.onLogIn(loggedInAccounts.get(0) || '')
        : dispatchProps._onBack,
    onSubmit: dispatchProps.onSubmit,
    waiting: stateProps.waiting,
  }
})(Container.safeSubmit(['onSubmit', 'onBack'], ['error'])(SetPublicName))
