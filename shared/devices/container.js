// @flow
import Render from '.'
import flags from '../util/feature-flags'
import {List} from 'immutable'
import {addNewPhone, addNewComputer} from '../actions/login/creators'
import {compose, lifecycle, mapProps, withState} from 'recompose'
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {load, paperKeyMake} from '../actions/devices'

import type {TypedState} from '../constants/reducer'

const getAllDevicesSelector = (state: TypedState) => state.devices.get('deviceIDs')
const getDeviceEntitiesSelector = (state: TypedState) => state.entities.get('devices')

const getDevicesAndRevokedDevicesSelector = createSelector(
  [getAllDevicesSelector, getDeviceEntitiesSelector],
  (allDevices, deviceEntities) => {
    const split = allDevices.groupBy(id => deviceEntities.get(id).revokedAt ? 'revokedDeviceIDs' : 'deviceIDs')
    const deviceIDs = split.get('deviceIDs', List())
    const revokedDeviceIDs = split.get('revokedDeviceIDs', List())
    return {
      deviceIDs,
      revokedDeviceIDs,
    }
  }
)

const mapStateToProps = (state: TypedState, {routeState}) => {
  const {showingRevoked} = routeState
  const {deviceIDs, revokedDeviceIDs} = getDevicesAndRevokedDevicesSelector(state)

  return {
    deviceIDs,
    revokedDeviceIDs,
    showingRevoked,
  }
}

const mapDispatchToProps = (dispatch: any, {routeState, setRouteState, navigateUp}) => ({
  addNewComputer: () => dispatch(addNewComputer()),
  addNewPaperKey: () => dispatch(paperKeyMake()),
  addNewPhone: () => dispatch(addNewPhone()),
  loadDevices: () => dispatch(load()),
  onToggleShowRevoked: () => { setRouteState({showingRevoked: !routeState.showingRevoked}) },
  title: 'Devices',
  onBack: () => dispatch(navigateUp()),
})

const menuItems = props => ([
  ...flags.mobileAppsExist && [{onClick: props.addNewPhone, title: 'New phone [in beta]'}] || [],
  {onClick: props.addNewComputer, title: 'New computer'},
  {onClick: props.addNewPaperKey, title: 'New paper key'},
])

const Devices = compose(
  lifecycle({
    componentWillMount: function () {
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
)(Render)

export default connect(mapStateToProps, mapDispatchToProps)(Devices)
