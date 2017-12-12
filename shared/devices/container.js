// @flow
import Devices from '.'
import * as DevicesGen from '../actions/devices-gen'
import * as I from 'immutable'
import * as LoginGen from '../actions/login-gen'
import * as LoginConstants from '../constants/login'
import {
  compose,
  lifecycle,
  mapProps,
  withState,
  withHandlers,
  connect,
  createSelector,
  type TypedState,
  type Dispatch,
} from '../util/container'

const getIdToDetail = (state: TypedState) => state.devices.idToDetail

const getDevicesAndRevokedDevicesSelector = createSelector([getIdToDetail], idToDetail => {
  const deviceIDs = []
  const revokedDeviceIDs = []
  idToDetail
    .sort((a, b) => {
      if (a.currentDevice) return -1
      if (b.currentDevice) return 1
      return a.name.localeCompare(b.name)
    })
    .forEach(detail => {
      if (detail.revokedAt) {
        revokedDeviceIDs.push(detail.deviceID)
      } else {
        deviceIDs.push(detail.deviceID)
      }
    })
  return {
    deviceIDs: I.List(deviceIDs),
    revokedDeviceIDs: I.List(revokedDeviceIDs),
  }
})

const mapStateToProps = (state: TypedState, {routeState}) => {
  const showingRevoked = routeState.get('showingRevoked')
  const {deviceIDs, revokedDeviceIDs} = getDevicesAndRevokedDevicesSelector(state)
  const waiting = state.devices.waiting

  return {
    deviceIDs,
    revokedDeviceIDs,
    showingRevoked,
    waiting,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeState, setRouteState, navigateUp}) => ({
  addNewComputer: () =>
    dispatch(LoginGen.createAddNewDevice({role: LoginConstants.codePageDeviceRoleNewComputer})),
  addNewPaperKey: () => dispatch(DevicesGen.createPaperKeyMake()),
  addNewPhone: () => dispatch(LoginGen.createAddNewDevice({role: LoginConstants.codePageDeviceRoleNewPhone})),
  loadDevices: () => dispatch(DevicesGen.createDevicesLoad()),
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
