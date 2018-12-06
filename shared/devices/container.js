// @flow
import Devices from '.'
import * as DevicesGen from '../actions/devices-gen'
import * as ProvisionGen from '../actions/provision-gen'
import * as RouteTree from '../actions/route-tree'
import * as Constants from '../constants/devices'
import * as I from 'immutable'
import {compose, namedConnect, safeSubmitPerMount} from '../util/container'
import {partition} from 'lodash-es'

const mapStateToProps = state => ({
  _deviceMap: state.devices.deviceMap,
  _newlyChangedItemIds: state.devices.isNew,
  waiting: Constants.isWaiting(state),
})

const mapDispatchToProps = dispatch => ({
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

type OwnProps = void

function mergeProps(stateProps, dispatchProps, ownProps: OwnProps) {
  const [revoked, normal] = splitAndSortDevices(stateProps._deviceMap)
  const revokedItems = revoked.map(deviceToItem)
  const newlyRevokedIds = I.Set(revokedItems.map(d => d.key)).intersect(stateProps._newlyChangedItemIds)
  return {
    _stateOverride: null,
    addNewComputer: dispatchProps.addNewComputer,
    addNewPaperKey: dispatchProps.addNewPaperKey,
    addNewPhone: dispatchProps.addNewPhone,
    hasNewlyRevoked: newlyRevokedIds.size > 0,
    items: normal.map(deviceToItem),
    loadDevices: dispatchProps.loadDevices,
    onBack: dispatchProps.onBack,
    revokedItems: revokedItems,
    title: 'Devices',
    waiting: stateProps.waiting,
  }
}

const Connected = compose(
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'Devices'),
  safeSubmitPerMount(['onBack'])
)(Devices)

export default Connected
