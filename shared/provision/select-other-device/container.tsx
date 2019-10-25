import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import SelectOtherDevice from '.'
import * as Container from '../../util/container'
import * as AutoresetGen from '../../actions/autoreset-gen'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => ({
  devices: state.provision.devices,
  username: state.provision.username,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => {
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onResetAccount: (username: string) =>
    dispatch(AutoresetGen.createStartAccountReset({skipPassword: false, username})),
  onSelect: (name: string) => {
    dispatch(ProvisionGen.createSubmitDeviceSelect({name}))
  },
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => ({
    devices: stateProps.devices.toArray(),
    onBack: dispatchProps.onBack,
    onResetAccount: () => dispatchProps.onResetAccount(stateProps.username),
    onSelect: dispatchProps.onSelect,
  })
)(Container.safeSubmitPerMount(['onSelect', 'onBack'])(SelectOtherDevice))
