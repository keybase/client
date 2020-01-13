import * as Container from '../../util/container'
import * as DevicesGen from '../../actions/devices-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as Constants from '../../constants/devices'
import AddDevice from '.'

type OwnProps = Container.RouteProps<{highlight: Array<'computer' | 'phone' | 'paper key'>}>

const noHighlight = []

export default Container.namedConnect(
  (state: Container.TypedState) => ({iconNumbers: Constants.getNextDeviceIconNumber(state)}),
  dispatch => ({
    onAddComputer: () => dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'desktop'})),
    onAddPaperKey: () => dispatch(DevicesGen.createShowPaperKeyPage()),
    onAddPhone: () => dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'mobile'})),
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (s, d, o: OwnProps) => ({
    ...s,
    ...d,
    highlight: Container.getRouteProps(o, 'highlight', noHighlight),
  }),
  'AddDevice'
)(AddDevice)
