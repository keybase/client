// @flow
import * as Container from '../../util/container'
import * as DevicesGen from '../../actions/devices-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import AddDevice from '.'
import flags from '../../util/feature-flags'
import type {RouteProps} from '../../route-tree/render-route'

const mapDispatchToProps = (dispatch, {navigateUp, navigation}) => ({
  onAddComputer: () => {
    if (!flags.useNewRouter) {
      dispatch(navigateUp())
    }
    dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'desktop'}))
  },
  onAddPaperKey: () => {
    if (!flags.useNewRouter) {
      dispatch(navigateUp())
    }
    dispatch(DevicesGen.createShowPaperKeyPage())
  },
  onAddPhone: () => {
    if (!flags.useNewRouter) {
      dispatch(navigateUp())
    }
    dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'mobile'}))
  },
  onCancel: () => {
    if (flags.useNewRouter) {
      // We don't have navigateUp in upgraded Routes
      dispatch(RouteTreeGen.createNavigateUp())
    } else {
      dispatch(navigateUp())
    }
  },
})

export default Container.namedConnect<
  RouteProps<{highlight: Array<'computer' | 'phone' | 'paper key'>}, {}>,
  _,
  _,
  _,
  _
>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({
    ...d,
    highlight: Container.getRouteProps(o, 'highlight') || [],
    title: 'Add a device',
  }),
  'AddDevice'
)(AddDevice)
