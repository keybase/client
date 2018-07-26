// @flow
import Devices from '.'
import * as DevicesGen from '../actions/devices-gen'
import * as ProvisionGen from '../actions/provision-gen'
import * as Constants from '../constants/devices'
import {connect, type TypedState, type Dispatch} from '../util/container'
import {partition} from 'lodash-es'

const mapStateToProps = (state: TypedState, {routeState}) => ({
  _deviceMap: state.devices.deviceMap,
  waiting: Constants.isWaiting(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {routeState, setRouteState, navigateUp}) => ({
  _addNewComputer: () => dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'desktop'})),
  _addNewPaperKey: () => dispatch(DevicesGen.createPaperKeyMake()),
  _addNewPhone: () => dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'mobile'})),
  loadDevices: () => dispatch(DevicesGen.createLoad()),
  onBack: () => dispatch(navigateUp()),
})

const sortDevices = (a, b) => {
  if (a.currentDevice) return -1
  if (b.currentDevice) return 1
  return a.name.localeCompare(b.name)
}

const deviceToItem = d => ({id: d.deviceID, key: d.deviceID, type: 'device'})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const [normal, revoked] = partition(
    stateProps._deviceMap
      .valueSeq()
      .toArray()
      .sort(sortDevices),
    d => d.revokedAt
  )
  return {
    items: normal.map(deviceToItem),
    loadDevices: dispatchProps.loadDevices,
    menuItems: [
      {onClick: dispatchProps._addNewPhone, title: 'New phone'},
      {onClick: dispatchProps._addNewComputer, title: 'New computer', style: {borderTopWidth: 0}}, // get rid of auto-inserted border
      {onClick: dispatchProps._addNewPaperKey, title: 'New paper key'},
    ],
    onBack: dispatchProps.onBack,
    revokedItems: revoked.map(deviceToItem),
    title: 'Devices',
    waiting: stateProps.waiting,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Devices)
