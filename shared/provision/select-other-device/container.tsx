import * as ProvisionGen from '../../actions/provision-gen'
import * as LoginGen from '../../actions/login-gen'
import SelectOtherDevice from '.'
import {connect, compose, safeSubmitPerMount, TypedDispatch, TypedState} from '../../util/container'
import {RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: TypedState) => ({
  devices: state.provision.devices,
  loggedInAccounts: state.config.configuredAccounts
    .filter(account => account.hasStoredSecret)
    .map(account => account.username),
})
const mapDispatchToProps = (dispatch: TypedDispatch, ownProps: OwnProps) => ({
  onLogIn: (username: string) => dispatch(LoginGen.createLogin({password: null, username})),
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
    (stateProps, dispatchProps, ownProps: OwnProps) => ({
      devices: stateProps.devices.toArray(),
      onBack:
        stateProps.loggedInAccounts.size > 0
          ? () => dispatchProps.onLogIn(stateProps.loggedInAccounts.get(0))
          : null,
      onResetAccount: dispatchProps.onResetAccount,
      onSelect: dispatchProps.onSelect,
    })
  ),
  safeSubmitPerMount(['onSelect', 'onBack'])
)(SelectOtherDevice)
