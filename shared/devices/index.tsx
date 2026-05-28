import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import DeviceRow, {NewContext} from './row'
import partition from 'lodash/partition'
import * as T from '@/constants/types'
import {intersect} from '@/util/set'
import {useLocalBadging} from '@/util/use-local-badging'
import {useModalHeaderState} from '@/stores/modal-header'
import {HeaderTitle} from './nav-header'
import {useTypedNavigation} from '@/util/typed-navigation'

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
const navigation = useTypedNavigation('devicesRoot')
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

  const navigateAppend = C.Router2.navigateAppend
  const onAddDevice = (highlight?: Array<'computer' | 'phone' | 'paper key'>) => {
    // We don't have navigateAppend in upgraded routes
    navigateAppend({name: 'deviceAdd', params: {highlight}})
  }
  const navigateUp = C.Router2.navigateUp

  const revokedCount = devices.filter(d => d.revokedAt).length
  const activeCount = devices.length - revokedCount

  React.useEffect(() => {
    if (isMobile) {
      return
    }
    navigation.setOptions({
      headerTitle: () => <HeaderTitle activeCount={activeCount} revokedCount={revokedCount} />,
    })
  }, [activeCount, navigation, revokedCount])

  const [revoked, normal] = splitAndSortDevices(devices)
  const canRevoke = activeCount > 1
  const revokedItems = revoked.map(device => deviceToItem(device, canRevoke))
  const hasNewlyRevoked = intersect(new Set(revokedItems.map(d => d.key)), badged).size > 0
  const showPaperKeyNudge = !!devices.length && !devices.some(device => device.type === 'backup')
  const activeItems = normal.map(device => deviceToItem(device, canRevoke)) as Array<Item>

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
    ...activeItems,
    ...(activeItems.length ? [{key: 'revokedHeader', type: 'revokedHeader'} as const] : []),
    ...(revokedExpanded ? [{key: 'revokedNote', type: 'revokedNote'} as const, ...revokedItems] : []),
  ]

  return (
    <Kb.Reloadable
      onBack={isMobile ? navigateUp : undefined}
      waitingKeys={C.waitingKeyDevices}
      onReload={loadDevices}
      reloadOnMount={true}
      title=""
    >
      <NewContext value={badged}>
        <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} relative={true} testID={TestIDs.DEVICES_LIST}>
          {isMobile ? (
            <Kb.ClickableBox onClick={() => onAddDevice()} style={headerStyles.container}>
              <Kb.Button label="Add a device or paper key" fullWidth={true} />
              {waiting ? (
                <Kb.Box2 direction="vertical" centerChildren={true} style={styles.progressContainer}>
                  <Kb.ProgressIndicator />
                </Kb.Box2>
              ) : null}
            </Kb.ClickableBox>
          ) : null}
          {showPaperKeyNudge ? <PaperKeyNudge onAddDevice={() => onAddDevice(['paper key'])} /> : null}
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
      progressContainer: {
        ...Kb.Styles.globalStyles.fillAbsolute,
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
    ...Kb.Styles.centered(),
    height: isMobile ? 64 : 48,
    ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
    position: 'relative',
  },
}))

const PaperKeyNudge = ({onAddDevice}: {onAddDevice: () => void}) => (
  <Kb.ClickableBox onClick={onAddDevice}>
    <Kb.Box2 direction="horizontal" style={paperKeyNudgeStyles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal" gap="xsmall" alignItems="center" style={paperKeyNudgeStyles.border}>
        <Kb.IconAuto
          type={isMobile ? 'icon-onboarding-paper-key-48' : 'icon-onboarding-paper-key-32'}
        />
        <Kb.Box2 direction="vertical" flex={1}>
          <Kb.Text type="BodySemibold">Create a paper key</Kb.Text>
          <Kb.Text type={isMobile ? 'BodySmall' : 'Body'} style={paperKeyNudgeStyles.desc}>
            A paper key can be used to access your account in case you lose all your devices. Keep one in a
            safe place (like a wallet) to keep your data safe.
          </Kb.Text>
        </Kb.Box2>
        {!isMobile && <Kb.Text type="BodyBigLink">Create a paper key</Kb.Text>}
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ClickableBox>
)
const paperKeyNudgeStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      border: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.border(Kb.Styles.globalColors.black_05, 1, Kb.Styles.borderRadius),
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
