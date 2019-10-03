import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as LoginGen from '../../actions/login-gen'
import SelectOtherDevice from '.'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'
import flags from '../../util/feature-flags'
import * as AutoresetGen from '../../actions/autoreset-gen'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => ({
  configuredAccounts: state.config.configuredAccounts,
  devices: state.provision.devices,
  username: state.provision.username,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onBack: () => {
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onLogIn: (username: string) => dispatch(LoginGen.createLogin({password: new HiddenString(''), username})),
  onResetAccount: (username: string) => {
    if (flags.resetPipeline) {
      dispatch(AutoresetGen.createStartAccountReset({skipPassword: false, username}))
    } else {
      dispatch(LoginGen.createLaunchAccountResetWebPage())
      dispatch(RouteTreeGen.createNavigateUp())
    }
  },
  onSelect: (name: string) => {
    dispatch(ProvisionGen.createSubmitDeviceSelect({name}))
  },
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => {
    const loggedInAccounts = stateProps.configuredAccounts
      .filter(account => account.hasStoredSecret)
      .map(account => account.username)
    return {
      devices: stateProps.devices.toArray(),
      onBack:
        loggedInAccounts.length > 0
          ? () => dispatchProps.onLogIn(loggedInAccounts[0] || '')
          : dispatchProps._onBack,
      onResetAccount: () => dispatchProps.onResetAccount(stateProps.username),
      onSelect: dispatchProps.onSelect,
    }
  }
)(Container.safeSubmitPerMount(['onSelect', 'onBack'])(SelectOtherDevice))
