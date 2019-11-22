import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import SelectOtherDevice from '.'
import * as Container from '../../util/container'
import * as Constants from '../../constants/provision'
import * as AutoresetGen from '../../actions/autoreset-gen'

type OwnProps = {}

export default Container.connect(
  (state: Container.TypedState) => ({
    devices: state.provision.devices,
    username: state.provision.username,
    waiting: Container.anyWaiting(state, Constants.waitingKey),
  }),
  (dispatch: Container.TypedDispatch) => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onResetAccount: (username: string) =>
      dispatch(AutoresetGen.createStartAccountReset({skipPassword: false, username})),
    onSelect: (name: string) => {
      dispatch(ProvisionGen.createSubmitDeviceSelect({name}))
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    devices: stateProps.devices,
    onBack: dispatchProps.onBack,
    onResetAccount: () => dispatchProps.onResetAccount(stateProps.username),
    onSelect: (name: string) => !stateProps.waiting && dispatchProps.onSelect(name),
  })
)(Container.safeSubmitPerMount(['onSelect', 'onBack'])(SelectOtherDevice))
