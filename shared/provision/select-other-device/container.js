// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import * as LoginGen from '../../actions/login-gen'
import SelectOtherDevice from '.'
import {connect, type TypedState, type Dispatch, compose, safeSubmitPerMount} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: TypedState) => ({
  devices: state.provision.devices,
})
const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onResetAccount: () => {
    dispatch(LoginGen.createLaunchAccountResetWebPage())
    dispatch(ownProps.navigateUp())
  },
  onSelect: (name: string) => {
    console.log('aaaa onselect called')
    dispatch(ProvisionGen.createSubmitDeviceSelect({name}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  console.log('aaaa select other mergeprops call', stateProps, dispatchProps, ownProps)
  return {
    devices: stateProps.devices.map(d => d.toJS()).toArray(),
    onBack: dispatchProps.onBack,
    onResetAccount: dispatchProps.onResetAccount,
    onSelect: dispatchProps.onSelect,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  safeSubmitPerMount(['onSelect', 'onBack'])
)(SelectOtherDevice)
