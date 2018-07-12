// @flow
import * as LoginGen from '../../../actions/login-gen'
import SelectOtherDevice from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import {type RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: TypedState) => ({
  _canSelectNoDevice: state.login.provisionDevicesCanSelectNoDevice,
  devices: state.login.provisionDevices,
})
const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  _onUsePasswordInstead: () => dispatch(LoginGen.createSubmitProvisionPasswordInsteadOfDevice()),
  onBack: () => dispatch(ownProps.navigateUp()),
  onResetAccount: () => {
    dispatch(LoginGen.createLaunchAccountResetWebPage())
    dispatch(ownProps.navigateUp())
  },
  onSelect: (name: string) => dispatch(LoginGen.createSubmitProvisionDeviceSelect({name})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  devices: stateProps.devices.map(d => d.toJS()).toArray(),
  onBack: dispatchProps.onBack,
  onResetAccount: dispatchProps.onResetAccount,
  onSelect: dispatchProps.onSelect,
  onUsePasswordInstead: stateProps._canSelectNoDevice ? dispatchProps._onUsePasswordInstead : null,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(SelectOtherDevice)
