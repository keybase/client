import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import DeviceRow from './row'
import partition from 'lodash/partition'
import * as T from '@/constants/types'
import {intersect} from '@/util/set'
import {settingsDevicesTab} from '@/constants/settings'
import {NewItemsContext, useLocalBadging} from '@/util/use-local-badging'
import {useRPCLoad} from '@/util/use-rpc-load'
import {useNotifState} from '@/stores/notifications'
import {useNavigation} from '@react-navigation/native'
import {rpcDeviceDetailToDevice, HeaderTitle} from './common'
import {useEngineActionListener} from '@/engine/action-listener'

const sortDevices = (a: T.Devices.Device, b: T.Devices.Device) => {
  if (a.currentDevice) return -1
  if (b.currentDevice) return 1
  return a.name.localeCompare(b.name)
}

const deviceToItem = (device: T.Devices.Device, canRevoke: boolean) => ({
  canRevoke,
  device,
  key: device.deviceID,
  type: 'device',
}) as const
const splitAndSortDevices = (devices: ReadonlyArray<T.Devices.Device>) =>
  partition([...devices].sort(sortDevices), d => d.revokedAt)

const itemHeight = {height: 48, type: 'fixed'} as const
const noDevices = new Array<T.Devices.Device>()

function ReloadableDevices() {
  // mounts as its own tab on desktop but under settings on mobile/tablet
  const navigation = useNavigation(isMobile ? settingsDevicesTab : 'devicesRoot')
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyDevices)
  const clearBadges = useNotifState(s => s.dispatch.clearDeviceBadges)
  const storeSet = useNotifState(s => s.deviceBadges)
  const {badged} = useLocalBadging(storeSet, clearBadges)

  // Reloadable's reloadOnMount drives the initial load
  const {data, reload: loadDevices} = useRPCLoad(
    T.RPCGen.deviceDeviceHistoryListRpcPromise,
    [undefined, C.waitingKeyDevices],
    {map: results => results?.map(rpcDeviceDetailToDevice) ?? [], when: 'manual'}
  )
  const devices = data ?? noDevices

  useEngineActionListener('keybase.1.NotifyDeviceHistory.deviceHistoryChanged', () => {
    loadDevices()
  })

  const navigateAppend = C.Router2.navigateAppend
  const onAddDevice = (highlight?: Array<'computer' | 'phone' | 'paper key'>) => {
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
      <NewItemsContext value={badged}>
        <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} relative={true} testID={TestIDs.DEVICES_LIST}>
          {isMobile ? (
            <Kb.ClickableBox onClick={() => onAddDevice()} direction="horizontal" centerChildren={true} relative={true} style={styles.mobileAddHeader}>
              <Kb.Button label="Add a device or paper key" fullWidth={true} />
              <Kb.LoadingOverlay show={waiting} />
            </Kb.ClickableBox>
          ) : null}
          {showPaperKeyNudge ? <PaperKeyNudge onAddDevice={() => onAddDevice(['paper key'])} /> : null}
          <Kb.BoxGrow2>
            <Kb.List bounces={false} items={items} renderItem={renderItem} itemHeight={itemHeight} keyProperty="key" />
          </Kb.BoxGrow2>
        </Kb.Box2>
      </NewItemsContext>
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
      mobileAddHeader: {
        height: isMobile ? 64 : 48,
        ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
      },
      paperKeyNudgeContainer: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.border(Kb.Styles.globalColors.black_05, 1, Kb.Styles.borderRadius),
          padding: Kb.Styles.globalMargins.small,
        },
        isElectron: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
        },
        isMobile: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
        },
      }),
      paperKeyNudgeDesc: Kb.Styles.platformStyles({
        isElectron: {
          maxWidth: 450,
        },
      }),
      revokedNote: {
        padding: Kb.Styles.globalMargins.medium,
        width: '100%',
      },
    }) as const
)

const PaperKeyNudge = ({onAddDevice}: {onAddDevice: () => void}) => (
  <Kb.ClickableBox
    onClick={onAddDevice}
    direction="horizontal"
    gap="xsmall"
    alignItems="center"
    fullWidth={true}
    style={styles.paperKeyNudgeContainer}
  >
    <Kb.IconAuto
      type={isMobile ? 'icon-onboarding-paper-key-48' : 'icon-onboarding-paper-key-32'}
    />
    <Kb.Box2 direction="vertical" flex={1}>
      <Kb.Text type="BodySemibold">Create a paper key</Kb.Text>
      <Kb.Text type={isMobile ? 'BodySmall' : 'Body'} style={styles.paperKeyNudgeDesc}>
        A paper key can be used to access your account in case you lose all your devices. Keep one in a
        safe place (like a wallet) to keep your data safe.
      </Kb.Text>
    </Kb.Box2>
    {!isMobile && <Kb.Text type="BodyBigLink">Create a paper key</Kb.Text>}
  </Kb.ClickableBox>
)
export default ReloadableDevices
