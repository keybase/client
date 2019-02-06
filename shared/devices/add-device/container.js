// @flow
import * as Container from '../../util/container'
import * as DevicesGen from '../../actions/devices-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import AddDevice from '.'
import type {RouteProps} from '../../route-tree/render-route'

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onAddComputer: () => {
    dispatch(navigateUp())
    dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'desktop'}))
  },
  onAddPaperKey: () => {
    dispatch(navigateUp())
    dispatch(DevicesGen.createShowPaperKeyPage())
  },
  onAddPhone: () => {
    dispatch(navigateUp())
    dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'mobile'}))
  },
  onCancel: () => dispatch(navigateUp()),
})

export default Container.namedConnect<RouteProps<{}, {}>, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => d,
  'AddDevice'
)(AddDevice)
