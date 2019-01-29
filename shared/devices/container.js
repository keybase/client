// @flow
import * as React from 'react'
import Devices from '.'
import * as DevicesGen from '../actions/devices-gen'
import * as ProvisionGen from '../actions/provision-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Constants from '../constants/devices'
import * as I from 'immutable'
import * as Kb from '../common-adapters'
import {compose, isMobile, namedConnect, safeSubmitPerMount} from '../util/container'
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
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
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

class ReloadableDevices extends React.PureComponent<React.ElementConfig<typeof Devices>> {
  render() {
    return (
      <Kb.Reloadable
        onBack={isMobile ? this.props.onBack : undefined}
        waitingKeys={Constants.waitingKey}
        onReload={this.props.loadDevices}
        reloadOnMount={true}
        title={this.props.title}
      >
        <Devices
          _stateOverride={this.props._stateOverride}
          addNewComputer={this.props.addNewComputer}
          addNewPaperKey={this.props.addNewPaperKey}
          addNewPhone={this.props.addNewPhone}
          hasNewlyRevoked={this.props.hasNewlyRevoked}
          items={this.props.items}
          loadDevices={this.props.loadDevices}
          onBack={this.props.onBack}
          revokedItems={this.props.revokedItems}
          title={this.props.title}
          waiting={this.props.waiting}
        />
      </Kb.Reloadable>
    )
  }
}

const Connected = compose(
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'Devices'),
  safeSubmitPerMount(['onBack'])
)(ReloadableDevices)

export default Connected
