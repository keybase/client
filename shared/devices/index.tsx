import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import DeviceRow, {NewContext} from './row'
import partition from 'lodash/partition'
import * as T from '@/constants/types'
import {intersect} from '@/util/set'
import {useLocalBadging} from '@/util/use-local-badging'
import {useModalHeaderState} from '@/stores/modal-header'
import {HeaderTitle} from './nav-header'
import {useNavigation} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'

type DevicesRootParamList = {devicesRoot: undefined}

const sortDevices = (a: T.Devices.Device, b: T.Devices.Device) => {
  if (a.currentDevice) return -1
  if (b.currentDevice) return 1
  return a.name.localeCompare(b.name)
}

const rpcDeviceToDevice = (d: T.RPCGen.DeviceDetail): T.Devices.Device => ({
  created: d.device.cTime,
  currentDevice: d.currentDevice,
  deviceID: T.Devices.stringToDeviceID(d.device.deviceID),
  deviceNumberOfType: d.device.deviceNumberOfType,
  lastUsed: d.device.lastUsedTime,
  name: d.device.name,
  provisionedAt: d.provisionedAt || undefined,
  provisionerName: d.provisioner ? d.provisioner.name : undefined,
  revokedAt: d.revokedAt || undefined,
  revokedByName: d.revokedByDevice ? d.revokedByDevice.name : undefined,
  type: T.Devices.stringToDeviceType(d.device.type),
})

const deviceToItem = (device: T.Devices.Device, canRevoke: boolean) => ({
  canRevoke,
  device,
  key: device.deviceID,
  type: 'device',
}) as const
const splitAndSortDevices = (devices: ReadonlyArray<T.Devices.Device>) =>
  partition([...devices].sort(sortDevices), d => d.revokedAt)

const itemHeight = {height: 48, type: 'fixed'} as const

function ReloadableDevices() {
  const navigation = useNavigation<NativeStackNavigationProp<DevicesRootParamList, 'devicesRoot'>>()
  const [devices, setDevices] = React.useState<Array<T.Devices.Device>>([])
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyDevices)
  const loadDevicesRPC = C.useRPC(T.RPCGen.deviceDeviceHistoryListRpcPromise)
  const clearBadges = useModalHeaderState(s => s.dispatch.clearDeviceBadges)
  const storeSet = useModalHeaderState(s => s.deviceBadges)
  const {badged} = useLocalBadging(storeSet, clearBadges)

  const loadDevices = React.useEffectEvent(() => {
    loadDevicesRPC(
      [undefined, C.waitingKeyDevices],
      results => {
        setDevices(results?.map(rpcDeviceToDevice) ?? [])
      },
      _ => {}
    )
  })

  const newlyChangedItemIds = badged

  const navigateAppend = C.Router2.navigateAppend
  const onAddDevice = (highlight?: Array<'computer' | 'phone' | 'paper key'>) => {
    // We don't have navigateAppend in upgraded routes
    navigateAppend({name: 'deviceAdd', params: {highlight}})
  }
  const navigateUp = C.Router2.navigateUp
  const onBack = () => {
    navigateUp()
  }

  const activeCount = devices.reduce((count, device) => (!device.revokedAt ? count + 1 : count), 0)
  const revokedCount = devices.reduce((count, device) => (device.revokedAt ? count + 1 : count), 0)

  React.useEffect(() => {
    if (Kb.Styles.isMobile) {
      return
    }
    navigation.setOptions({
      headerTitle: () => <HeaderTitle activeCount={activeCount} revokedCount={revokedCount} />,
    })
  }, [activeCount, navigation, revokedCount])

  const {showPaperKeyNudge, hasNewlyRevoked, revokedItems, _items} = (() => {
    const [revoked, normal] = splitAndSortDevices(devices)
    const canRevoke = activeCount > 1
    const revokedItems = revoked.map(device => deviceToItem(device, canRevoke))
    const newlyRevokedIds = intersect(new Set(revokedItems.map(d => d.key)), newlyChangedItemIds)
    const hasNewlyRevoked = newlyRevokedIds.size > 0
    const showPaperKeyNudge = !!devices.length && !devices.some(device => device.type === 'backup')
    const _items = normal.map(device => deviceToItem(device, canRevoke)) as Array<Item>
    return {
      _items,
      hasNewlyRevoked,
      revokedItems,
      showPaperKeyNudge,
    }
  })()

  const [revokedExpanded, setRevokeExpanded] = React.useState(false)
  const toggleExpanded = () => setRevokeExpanded(p => !p)

  const lastHasNewlyRevoked = React.useRef(hasNewlyRevoked)
  React.useEffect(() => {
    if (lastHasNewlyRevoked.current !== hasNewlyRevoked) {
      lastHasNewlyRevoked.current = hasNewlyRevoked
      setRevokeExpanded(true)
    }
  }, [hasNewlyRevoked])
  const renderItem = (index: number, item: Item) => {
    if (item.type === 'revokedHeader') {
      return (
        <Kb.SectionDivider
          key="revokedHeader"
          collapsed={!revokedExpanded}
          onToggleCollapsed={toggleExpanded}
          label="Revoked devices"
        />
      )
    } else if (item.type === 'revokedNote') {
      return (
        <Kb.Text center={true} type="BodySmall" style={styles.revokedNote}>
          Revoked devices are no longer able to access your Keybase account.
        </Kb.Text>
      )
    } else {
      return <DeviceRow key={item.key} canRevoke={item.canRevoke} device={item.device} firstItem={index === 0} />
    }
  }

  const items: Array<Item> = [
    ..._items,
    ...(_items.length ? [{key: 'revokedHeader', type: 'revokedHeader'} as const] : []),
    ...(revokedExpanded ? [{key: 'revokedNote', type: 'revokedNote'} as const, ...revokedItems] : []),
  ]

  return (
    <Kb.Reloadable
      onBack={C.isMobile ? onBack : undefined}
      waitingKeys={C.waitingKeyDevices}
      onReload={loadDevices}
      reloadOnMount={true}
      title=""
    >
      <NewContext value={badged}>
        <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} relative={true}>
          {Kb.Styles.isMobile ? (
            <Kb.ClickableBox onClick={() => onAddDevice()} style={headerStyles.container}>
              <Kb.Button label="Add a device or paper key" fullWidth={true} />
            </Kb.ClickableBox>
          ) : null}
          {showPaperKeyNudge ? <PaperKeyNudge onAddDevice={() => onAddDevice(['paper key'])} /> : null}
          {waiting ? <Kb.ProgressIndicator style={styles.progress} /> : null}
          <Kb.BoxGrow2>
            <Kb.List bounces={false} items={items} renderItem={renderItem} itemHeight={itemHeight} keyProperty="key" />
          </Kb.BoxGrow2>
        </Kb.Box2>
      </NewContext>
    </Kb.Reloadable>
  )
}

type Item =
  | {canRevoke: boolean; device: T.Devices.Device; key: string; type: 'device'}
  | {key: string; type: 'revokedHeader'}
  | {key: string; type: 'revokedNote'}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      progress: {
        left: 12,
        position: 'absolute',
        top: Kb.Styles.isMobile ? 22 : 14,
        width: 20,
      },
      revokedNote: {
        padding: Kb.Styles.globalMargins.medium,
        width: '100%',
      },
    }) as const
)

const headerStyles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: Kb.Styles.isMobile ? 64 : 48,
    justifyContent: 'center',
    paddingLeft: Kb.Styles.globalMargins.small,
    paddingRight: Kb.Styles.globalMargins.small,
  },
}))

const PaperKeyNudge = ({onAddDevice}: {onAddDevice: () => void}) => (
  <Kb.ClickableBox onClick={onAddDevice}>
    <Kb.Box2 direction="horizontal" style={paperKeyNudgeStyles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal" gap="xsmall" alignItems="center" style={paperKeyNudgeStyles.border}>
        <Kb.IconAuto
          type={Kb.Styles.isMobile ? 'icon-onboarding-paper-key-48' : 'icon-onboarding-paper-key-32'}
        />
        <Kb.Box2 direction="vertical" flex={1}>
          <Kb.Text type="BodySemibold">Create a paper key</Kb.Text>
          <Kb.Text type={Kb.Styles.isMobile ? 'BodySmall' : 'Body'} style={paperKeyNudgeStyles.desc}>
            A paper key can be used to access your account in case you lose all your devices. Keep one in a
            safe place (like a wallet) to keep your data safe.
          </Kb.Text>
        </Kb.Box2>
        {!Kb.Styles.isMobile && <Kb.Text type="BodyBigLink">Create a paper key</Kb.Text>}
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ClickableBox>
)
const paperKeyNudgeStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      border: Kb.Styles.platformStyles({
        common: {
          borderColor: Kb.Styles.globalColors.black_05,
          borderRadius: Kb.Styles.borderRadius,
          borderStyle: 'solid',
          borderWidth: 1,
          flex: 1,
        },
        isElectron: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
        },
        isMobile: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
        },
      }),
      container: Kb.Styles.platformStyles({
        common: {
          padding: Kb.Styles.globalMargins.small,
        },
        isMobile: {
          padding: Kb.Styles.globalMargins.tiny,
        },
      }),
      desc: Kb.Styles.platformStyles({
        isElectron: {
          maxWidth: 450,
        },
      }),
    }) as const
)
export default ReloadableDevices
