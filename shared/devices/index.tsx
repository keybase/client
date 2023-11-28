import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import DeviceRow, {NewContext} from './row'
import partition from 'lodash/partition'
import type * as T from '@/constants/types'
import {intersect} from '@/util/set'
import {useFocusEffect} from '@react-navigation/core'
import {useLocalBadging} from '@/util/use-local-badging'

const sortDevices = (a: T.Devices.Device, b: T.Devices.Device) => {
  if (a.currentDevice) return -1
  if (b.currentDevice) return 1
  return a.name.localeCompare(b.name)
}

const deviceToItem = (d: T.Devices.Device) => ({id: d.deviceID, key: d.deviceID, type: 'device'}) as const
const splitAndSortDevices = (deviceMap: Map<string, T.Devices.Device>) =>
  partition([...deviceMap.values()].sort(sortDevices), d => d.revokedAt)

const ReloadableDevices = () => {
  const deviceMap = C.useDevicesState(s => s.deviceMap)
  const waiting = C.useAnyWaiting(C.devicesWaitingKey)
  const {load, clearBadges} = C.useDevicesState(s => s.dispatch)
  const storeSet = C.useDevicesState(s => s.isNew)
  const {badged} = useLocalBadging(storeSet, clearBadges)

  const newlyChangedItemIds = badged

  useFocusEffect(
    React.useCallback(() => {
      load()
    }, [load])
  )

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onAddDevice = (highlight?: Array<'computer' | 'phone' | 'paper key'>) => {
    // We don't have navigateAppend in upgraded routes
    navigateAppend({props: {highlight}, selected: 'deviceAdd'})
  }
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
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
    hasNewlyRevoked,
    items,
    loadDevices: load,
    onAddDevice,
    onBack,
    revokedItems,
    showPaperKeyNudge,
    title: 'Devices',
    waiting,
  }

  return (
    <Kb.Reloadable
      onBack={C.isMobile ? onBack : undefined}
      waitingKeys={C.devicesWaitingKey}
      onReload={load}
      reloadOnMount={true}
      title={''}
    >
      <NewContext.Provider value={badged}>
        <Devices {...np} />
      </NewContext.Provider>
    </Kb.Reloadable>
  )
}

type Item =
  | {key: string; id: T.Devices.DeviceID; type: 'device'}
  | {key: string; type: 'revokedHeader'}
  | {key: string; type: 'revokedNote'}

type State = {
  revokedExpanded: boolean
}

export type Props = {
  _stateOverride?: State
  items: Array<Item>
  loadDevices: () => void
  onAddDevice: (highlight?: Array<'computer' | 'phone' | 'paper key'>) => void
  onBack: () => void
  revokedItems: Array<Item>
  showPaperKeyNudge: boolean
  hasNewlyRevoked: boolean
  waiting: boolean
  title: string
}

class Devices extends React.PureComponent<Props, State> {
  static defaultProps = {_stateOverride: null}
  state = {revokedExpanded: this.props._stateOverride?.revokedExpanded ?? false}

  componentDidMount() {
    this.props.loadDevices()
  }

  componentDidUpdate(_: Props, prevState: State) {
    if (this.props.hasNewlyRevoked && !prevState.revokedExpanded) {
      this.setState({revokedExpanded: true})
    }
  }

  private toggleExpanded = () => this.setState(p => ({revokedExpanded: !p.revokedExpanded}))

  private renderItem = (index: number, item: Item) => {
    if (item.type === 'revokedHeader') {
      return (
        <RevokedHeader
          key="revokedHeader"
          expanded={this.state.revokedExpanded}
          onToggleExpanded={this.toggleExpanded}
        />
      )
    } else if (item.type === 'revokedNote') {
      return (
        <Kb.Text center={true} type="BodySmall" style={styles.revokedNote}>
          Revoked devices are no longer able to access your Keybase account.
        </Kb.Text>
      )
    } else {
      return <DeviceRow key={item.id} deviceID={item.id} firstItem={index === 0} />
    }
  }

  render() {
    const items: Array<Item> = [
      ...this.props.items,
      ...(this.props.items.length ? [{key: 'revokedHeader', type: 'revokedHeader'} as const] : []),
      ...(this.state.revokedExpanded
        ? [{key: 'revokedNote', type: 'revokedNote'} as const, ...this.props.revokedItems]
        : []),
    ]

    return (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
        {Kb.Styles.isMobile && <DeviceHeader onAddNew={() => this.props.onAddDevice()} />}
        {this.props.showPaperKeyNudge && (
          <PaperKeyNudge onAddDevice={() => this.props.onAddDevice(['paper key'])} />
        )}
        {this.props.waiting && <Kb.ProgressIndicator style={styles.progress} />}
        <Kb.Box2 direction="vertical" fullWidth={true} style={{flexGrow: 1, flexShrink: 1}}>
          <Kb.List2
            bounces={false}
            items={items}
            renderItem={this.renderItem}
            itemHeight={{
              height: 48,
              type: 'fixed',
            }}
          />
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {position: 'relative'},
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

const DeviceHeader = ({onAddNew}: any) => (
  <Kb.ClickableBox onClick={onAddNew} style={headerStyles.container}>
    <Kb.Button label="Add a device or paper key" fullWidth={true} />
  </Kb.ClickableBox>
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
  icon: {
    alignSelf: 'center',
    marginRight: Kb.Styles.globalMargins.tiny,
  },
}))

const RevokedHeader = ({onToggleExpanded, expanded}: any) => (
  <Kb.SectionDivider collapsed={!expanded} onToggleCollapsed={onToggleExpanded} label="Revoked devices" />
)

const PaperKeyNudge = ({onAddDevice}: any) => (
  <Kb.ClickableBox onClick={onAddDevice}>
    <Kb.Box2 direction="horizontal" style={paperKeyNudgeStyles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal" gap="xsmall" alignItems="center" style={paperKeyNudgeStyles.border}>
        <Kb.Icon
          type={Kb.Styles.isMobile ? 'icon-onboarding-paper-key-48' : 'icon-onboarding-paper-key-32'}
        />
        <Kb.Box2 direction="vertical" style={paperKeyNudgeStyles.flexOne}>
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
      flexOne: {flex: 1},
    }) as const
)
export default ReloadableDevices
