import * as Container from '../../util/container'
import * as DevicesGen from '../../actions/devices-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import AddDevice from '.'
import {RouteProps} from '../../route-tree/render-route'

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onAddComputer: () => dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'desktop'})),
  onAddPaperKey: () => dispatch(DevicesGen.createShowPaperKeyPage()),
  onAddPhone: () => dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'mobile'})),
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
})

type OwnProps = RouteProps<{highlight: Array<'computer' | 'phone' | 'paper key'>}, {}>

export default Container.namedConnect(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({
    ...d,
    highlight: Container.getRouteProps(o, 'highlight') || [],
    title: 'Add a device',
  }),
  'AddDevice'
)(AddDevice)
