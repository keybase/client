// @flow
import Devices from '.'
import * as DevicesGen from '../actions/devices-gen'
import * as ProvisionGen from '../actions/provision-gen'
import * as RouteTree from '../actions/route-tree'
import * as Constants from '../constants/devices'
import * as I from 'immutable'
import {compose, connect, setDisplayName, safeSubmitPerMount} from '../util/container'
import {partition} from 'lodash-es'

const mapStateToProps = state => ({
  _deviceMap: state.devices.deviceMap,
  waiting: Constants.isWaiting(state),
  newlyChangedItemIds: state.devices.getIn(['isNew'], []),
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
  const newlyRevokedIds = I.Set(revokedItems.map(d => d.key)).intersect(
    I.Set(stateProps.newlyChangedItemIds || [])
  )
  return {
    _stateOverride: newlyRevokedIds.size > 0 ? {revokedExpanded: true} : null,
    addNewComputer: dispatchProps.addNewComputer,
    addNewPaperKey: dispatchProps.addNewPaperKey,
    addNewPhone: dispatchProps.addNewPhone,
    items: normal.map(deviceToItem),
    loadDevices: dispatchProps.loadDevices,
    onBack: dispatchProps.onBack,
    revokedItems: revokedItems,
    title: 'Devices',
    waiting: stateProps.waiting,
  }
}

const Connected = compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('Devices'),
  safeSubmitPerMount(['onBack'])
)(Devices)

export default Connected
