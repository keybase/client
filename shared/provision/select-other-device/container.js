// @flow
import * as Constants from '../../constants/provision'
import * as ProvisionGen from '../../actions/provision-gen'
import * as LoginGen from '../../actions/login-gen'
import SelectOtherDevice from '.'
import {connect, type TypedState, type Dispatch} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: TypedState) => ({
  devices: state.provision.devices,
  waiting: !!state.waiting.get(Constants.waitingKey),
})
const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onResetAccount: () => {
    dispatch(LoginGen.createLaunchAccountResetWebPage())
    dispatch(ownProps.navigateUp())
  },
  onSelect: (name: string) => dispatch(ProvisionGen.createSubmitDeviceSelect({name})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  devices: stateProps.devices.map(d => d.toJS()).toArray(),
  onBack: dispatchProps.onBack,
  onResetAccount: dispatchProps.onResetAccount,
  onSelect: ownProps.waiting ? () => {} : dispatchProps.onSelect,
  waiting: ownProps.waiting,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(SelectOtherDevice)
