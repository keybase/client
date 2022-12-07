import * as Constants from '../constants/devices'
import * as Container from '../util/container'
import * as DevicesGen from '../actions/devices-gen'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import type * as Types from '../constants/types/devices'
import Devices, {type Props, type Item} from '.'
import partition from 'lodash/partition'
import {HeaderTitle, HeaderRightActions} from './nav-header/container'
import {intersect} from '../util/set'

const sortDevices = (a: Types.Device, b: Types.Device) => {
  if (a.currentDevice) return -1
  if (b.currentDevice) return 1
  return a.name.localeCompare(b.name)
}

const deviceToItem = (d: Types.Device) => ({id: d.deviceID, key: d.deviceID, type: 'device'} as const)
const splitAndSortDevices = (deviceMap: Map<string, Types.Device>) =>
  partition([...deviceMap.values()].sort(sortDevices), d => d.revokedAt)

const ReloadableDevices = (props: Props) => {
  const deviceMap = Container.useSelector(state => state.devices.deviceMap)
  const newlyChangedItemIds = Container.useSelector(state => state.devices.isNew)
  const waiting = Container.useSelector(state => Constants.isWaiting(state))

  const dispatch = Container.useDispatch()

  const loadDevices = () => {
    dispatch(DevicesGen.createLoad())
  }
  const onAddDevice = (highlight?: Array<'computer' | 'phone' | 'paper key'>) => {
    // We don't have navigateAppend in upgraded routes
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {highlight}, selected: 'deviceAdd'}]}))
  }
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }

  const {showPaperKeyNudge, hasNewlyRevoked, revokedItems, items} = React.useMemo(() => {
    const [revoked, normal] = splitAndSortDevices(deviceMap)
    const revokedItems = revoked.map(deviceToItem)
    const newlyRevokedIds = intersect(new Set(revokedItems.map(d => d.key)), newlyChangedItemIds)
    const hasNewlyRevoked = newlyRevokedIds.size > 0
    const showPaperKeyNudge = !!deviceMap.size && ![...deviceMap.values()].some(v => v.type === 'backup')
    const items = normal.map(deviceToItem) as Array<Item>
    return {
      hasNewlyRevoked,
      items,
      revokedItems,
      showPaperKeyNudge,
    }
  }, [deviceMap, newlyChangedItemIds])

  const np = {
    _stateOverride: null,
    hasNewlyRevoked,
    items,
    loadDevices,
    onAddDevice,
    onBack,
    revokedItems,
    showPaperKeyNudge,
    title: 'Devices',
    waiting,
  }

  const {title} = props
  React.useEffect(() => {
    return () => {
      dispatch(DevicesGen.createClearBadges())
    }
  }, [dispatch])

  return (
    <Kb.Reloadable
      onBack={Container.isMobile ? onBack : undefined}
      waitingKeys={Constants.waitingKey}
      onReload={loadDevices}
      reloadOnMount={true}
      title={title}
    >
      <Devices {...np} />
    </Kb.Reloadable>
  )
}

ReloadableDevices.navigationOptions = Container.isMobile
  ? {title: 'Devices'}
  : {
      headerRightActions: HeaderRightActions,
      headerTitle: HeaderTitle,
      title: 'Devices',
    }

export default ReloadableDevices
