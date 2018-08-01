// @flow
import Devices from '.'
import * as DevicesGen from '../actions/devices-gen'
import * as ProvisionGen from '../actions/provision-gen'
import * as RouteTree from '../actions/route-tree'
import * as Constants from '../constants/devices'
import * as Container from '../util/container'
import {partition} from 'lodash-es'

const mapStateToProps = (state: Container.TypedState) => ({
  _deviceMap: state.devices.deviceMap,
  waiting: Constants.isWaiting(state),
})

const mapDispatchToProps = (dispatch: Container.Dispatch) => ({
  addNewComputer: () => dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'desktop'})),
  addNewPaperKey: () => dispatch(DevicesGen.createShowPaperKeyPage()),
  addNewPhone: () => dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'mobile'})),
  loadDevices: () => dispatch(DevicesGen.createLoad()),
  onBack: () => dispatch(RouteTree.navigateUp()),
})

const sortDevices = (a, b) => {
  if (a.currentDevice) return -1
  if (b.currentDevice) return 1
  return a.name.localeCompare(b.name)
}

const deviceToItem = d => ({id: d.deviceID, key: d.deviceID, type: 'device'})
const splitAndSortDevices = deviceMap =>
  partition(
    deviceMap
      .valueSeq()
      .toArray()
      .sort(sortDevices),
    d => d.revokedAt
  )

const mergeProps = (stateProps, dispatchProps) => {
  const [revoked, normal] = splitAndSortDevices(stateProps._deviceMap)
  return {
    _stateOverride: null,
    addNewComputer: dispatchProps.addNewComputer,
    addNewPaperKey: dispatchProps.addNewPaperKey,
    addNewPhone: dispatchProps.addNewPhone,
    items: normal.map(deviceToItem),
    loadDevices: dispatchProps.loadDevices,
    onBack: dispatchProps.onBack,
    revokedItems: revoked.map(deviceToItem),
    title: 'Devices',
    waiting: stateProps.waiting,
  }
}

export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  Container.setDisplayName('Devices'),
  Container.safeSubmitPerMount(['onBack'])
)(Devices)
