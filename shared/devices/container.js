// @flow
import Devices from '.'
import * as DevicesGen from '../actions/devices-gen'
import * as I from 'immutable'
import * as LoginGen from '../actions/login-gen'
import * as Constants from '../constants/devices'
import * as LoginConstants from '../constants/login'
import {
  compose,
  lifecycle,
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

  return {
    deviceIDs,
    revokedDeviceIDs,
    showingRevoked,
    waiting: Constants.isWaiting(state),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeState, setRouteState, navigateUp}) => ({
  _addNewComputer: () =>
    dispatch(LoginGen.createAddNewDevice({role: LoginConstants.codePageDeviceRoleNewComputer})),
  _addNewPaperKey: () => dispatch(DevicesGen.createPaperKeyMake()),
  _addNewPhone: () =>
    dispatch(LoginGen.createAddNewDevice({role: LoginConstants.codePageDeviceRoleNewPhone})),
  _loadDevices: () => dispatch(DevicesGen.createDevicesLoad()),
  onBack: () => dispatch(navigateUp()),
  onToggleShowRevoked: () => {
    setRouteState({showingRevoked: !routeState.get('showingRevoked')})
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  _loadDevices: dispatchProps._loadDevices,
  deviceIDs: stateProps.deviceIDs.toArray(),
  menuItems: [
    {onClick: dispatchProps._addNewPhone, title: 'New phone'},
    {onClick: dispatchProps._addNewComputer, title: 'New computer'},
    {onClick: dispatchProps._addNewPaperKey, title: 'New paper key'},
  ],
  onBack: dispatchProps.onBack,
  onToggleShowRevoked: dispatchProps.onToggleShowRevoked,
  revokedDeviceIDs: stateProps.revokedDeviceIDs.toArray(),
  showingRevoked: stateProps.showingRevoked,
  title: 'Devices',
  waiting: stateProps.waiting,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentWillMount: function() {
      this.props._loadDevices()
    },
  }),
  withState('showingMenu', '_setShowingMenu', false),
  withHandlers({
    hideMenu: props => () => props._setShowingMenu(false),
    showMenu: props => () => props._setShowingMenu(true),
  })
)(Devices)
