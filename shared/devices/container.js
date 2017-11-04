// @flow
import Devices from '.'
import * as I from 'immutable'
import * as LoginGen from '../actions/login-gen'
import {
  compose,
  lifecycle,
  mapProps,
  withState,
  withHandlers,
  connect,
  createSelector,
  type TypedState,
} from '../util/container'
import {load, paperKeyMake} from '../actions/devices'

const getAllDevicesSelector = (state: TypedState) => state.devices.get('deviceIDs')
const getDeviceEntitiesSelector = (state: TypedState) => state.entities.get('devices')

const getDevicesAndRevokedDevicesSelector = createSelector(
  [getAllDevicesSelector, getDeviceEntitiesSelector],
  (allDevices, deviceEntities) => {
    const split = allDevices.groupBy(
      id => (deviceEntities.getIn([id, 'revokedAt']) ? 'revokedDeviceIDs' : 'deviceIDs')
    )
    const deviceIDs = split.get('deviceIDs', I.List())
    const revokedDeviceIDs = split.get('revokedDeviceIDs', I.List())
    return {
      deviceIDs,
      revokedDeviceIDs,
    }
  }
)

const mapStateToProps = (state: TypedState, {routeState}) => {
  const {showingRevoked} = routeState.toObject()
  const {deviceIDs, revokedDeviceIDs} = getDevicesAndRevokedDevicesSelector(state)
  const waitingForServer = state.devices.get('waitingForServer')

  return {
    deviceIDs,
    revokedDeviceIDs,
    showingRevoked,
    waitingForServer,
  }
}

const mapDispatchToProps = (dispatch: any, {routeState, setRouteState, navigateUp}) => ({
  addNewComputer: () => dispatch(LoginGen.createAddNewComputer()),
  addNewPaperKey: () => dispatch(paperKeyMake()),
  addNewPhone: () => dispatch(LoginGen.createAddNewPhone()),
  loadDevices: () => dispatch(load()),
  onBack: () => dispatch(navigateUp()),
  onToggleShowRevoked: () => {
    setRouteState({showingRevoked: !routeState.get('showingRevoked')})
  },
  title: 'Devices',
})

const menuItems = props => [
  {onClick: props.addNewPhone, title: 'New phone'},
  {onClick: props.addNewComputer, title: 'New computer'},
  {onClick: props.addNewPaperKey, title: 'New paper key'},
]

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount: function() {
      this.props.loadDevices()
    },
  }),
  // Don't pass immutable things to dumb components
  mapProps(props => ({
    ...props,
    deviceIDs: props.deviceIDs.toArray(),
    menuItems: menuItems(props),
    revokedDeviceIDs: props.revokedDeviceIDs.toArray(),
  })),
  withState('showingMenu', 'setShowingMenu', false),
  withHandlers({
    hideMenu: props => () => props.setShowingMenu(false),
    showMenu: props => () => props.setShowingMenu(true),
  })
)(Devices)
