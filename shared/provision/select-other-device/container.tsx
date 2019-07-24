import * as ProvisionGen from '../../actions/provision-gen'
import * as LoginGen from '../../actions/login-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import SelectOtherDevice from '.'
import * as Container from '../../util/container'
import {RouteProps} from '../../route-tree/render-route'
import HiddenString from '../../util/hidden-string'

type OwnProps = RouteProps

const mapStateToProps = (state: Container.TypedState) => ({
  configuredAccounts: state.config.configuredAccounts,
  devices: state.provision.devices,
})
const mapDispatchToProps = (dispatch: Container.TypedDispatch, _: OwnProps) => ({
  onLogIn: (username: string) => dispatch(LoginGen.createLogin({password: new HiddenString(''), username})),
  onResetAccount: () => {
    dispatch(LoginGen.createLaunchAccountResetWebPage())
    dispatch(RouteTreeGen.createNavigateUp())
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
        loggedInAccounts.size > 0 ? () => dispatchProps.onLogIn(loggedInAccounts.get(0) || '') : undefined,
      onResetAccount: dispatchProps.onResetAccount,
      onSelect: dispatchProps.onSelect,
    }
  }
)(Container.safeSubmitPerMount(['onSelect', 'onBack'])(SelectOtherDevice))
