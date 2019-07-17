import * as ProvisionGen from '../../actions/provision-gen'
import * as LoginGen from '../../actions/login-gen'
import SelectOtherDevice from '.'
import {connect, compose, safeSubmitPerMount, TypedDispatch, TypedState} from '../../util/container'
import {RouteProps} from '../../route-tree/render-route'
import HiddenString from '../../util/hidden-string'

type OwnProps = RouteProps

const mapStateToProps = (state: TypedState) => ({
  configuredAccounts: state.config.configuredAccounts,
  devices: state.provision.devices,
})
const mapDispatchToProps = (dispatch: TypedDispatch, ownProps: OwnProps) => ({
  onLogIn: (username: string) => dispatch(LoginGen.createLogin({password: new HiddenString(''), username})),
  onResetAccount: () => {
    dispatch(LoginGen.createLaunchAccountResetWebPage())
    dispatch(ownProps.navigateUp())
  },
  onSelect: (name: string) => {
    dispatch(ProvisionGen.createSubmitDeviceSelect({name}))
  },
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (stateProps, dispatchProps, ownProps: OwnProps) => {
      const loggedInAccounts = stateProps.configuredAccounts
        .filter(account => account.hasStoredSecret)
        .map(account => account.username)
      return {
        devices: stateProps.devices.toArray(),
        onBack: loggedInAccounts.size > 0 ? () => dispatchProps.onLogIn(loggedInAccounts.get(0) || '') : null,
        onResetAccount: dispatchProps.onResetAccount,
        onSelect: dispatchProps.onSelect,
      }
    }
  ),
  safeSubmitPerMount(['onSelect', 'onBack'])
)(SelectOtherDevice)
