import * as ProvisionGen from '../../actions/provision-gen'
import * as LoginGen from '../../actions/login-gen'
import SelectOtherDevice from '.'
import {connect, compose, safeSubmitPerMount} from '../../util/container'
import {RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  devices: state.provision.devices,
})
const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onBack: () => {},
  onResetAccount: () => {
    dispatch(LoginGen.createLaunchAccountResetWebPage())
    dispatch(ownProps.navigateUp())
  },
  onSelect: (name: string) => {
    dispatch(ProvisionGen.createSubmitDeviceSelect({name}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  devices: stateProps.devices.toArray(),
  onBack: dispatchProps.onBack,
  onResetAccount: dispatchProps.onResetAccount,
  onSelect: dispatchProps.onSelect,
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  safeSubmitPerMount(['onSelect', 'onBack'])
)(SelectOtherDevice)
