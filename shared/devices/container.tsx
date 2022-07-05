import * as Constants from '../constants/devices'
import * as Container from '../util/container'
import * as DevicesGen from '../actions/devices-gen'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Types from '../constants/types/devices'
import Devices, {Props, Item} from '.'
import partition from 'lodash/partition'
import {HeaderTitle, HeaderRightActions} from './nav-header/container'
import {intersect} from '../util/set'

type OwnProps = Container.RouteProps

const sortDevices = (a: Types.Device, b: Types.Device) => {
  if (a.currentDevice) return -1
  if (b.currentDevice) return 1
  return a.name.localeCompare(b.name)
}

const deviceToItem = (d: Types.Device) => ({id: d.deviceID, key: d.deviceID, type: 'device'})
const splitAndSortDevices = (deviceMap: Map<string, Types.Device>) =>
  partition([...deviceMap.values()].sort(sortDevices), d => d.revokedAt)

const ReloadableDevices = (props: Props) => {
  const {loadDevices, title, onBack} = props
  const dispatch = Container.useDispatch()
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
      <Devices {...props} />
    </Kb.Reloadable>
  )
}

ReloadableDevices.navigationOptions = Container.isMobile
  ? {
      header: undefined,
      title: 'Devices',
    }
  : {
      header: undefined,
      headerRightActions: HeaderRightActions,
      headerTitle: HeaderTitle,
      title: 'Devices',
    }

const NamedConnected = Container.namedConnect(
  state => ({
    _deviceMap: state.devices.deviceMap,
    _newlyChangedItemIds: state.devices.isNew,
    waiting: Constants.isWaiting(state),
  }),
  dispatch => ({
    loadDevices: () => dispatch(DevicesGen.createLoad()),
    onAddDevice: (highlight?: Array<'computer' | 'phone' | 'paper key'>) => {
      // We don't have navigateAppend in upgraded routes
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {highlight}, selected: 'deviceAdd'}]}))
    },
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const [revoked, normal] = splitAndSortDevices(stateProps._deviceMap)
    const revokedItems = revoked.map(deviceToItem)
    const newlyRevokedIds = intersect(new Set(revokedItems.map(d => d.key)), stateProps._newlyChangedItemIds)
    const showPaperKeyNudge =
      !!stateProps._deviceMap.size && ![...stateProps._deviceMap.values()].some(v => v.type === 'backup')
    return {
      _stateOverride: null,
      hasNewlyRevoked: newlyRevokedIds.size > 0,
      items: normal.map(deviceToItem) as Array<Item>,
      loadDevices: dispatchProps.loadDevices,
      onAddDevice: dispatchProps.onAddDevice,
      onBack: dispatchProps.onBack,
      revokedItems: revokedItems as Array<Item>,
      showPaperKeyNudge,
      title: 'Devices',
      waiting: stateProps.waiting,
    }
  },
  'Devices'
)

const SafeSub = Container.safeSubmitPerMount(['onBack'])
export default NamedConnected(SafeSub(ReloadableDevices))
