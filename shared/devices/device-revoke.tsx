import * as C from '@/constants'
import * as Constants from '@/constants/devices'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'

type OwnProps = {deviceID: string}

class EndangeredTLFList extends React.Component<{endangeredTLFs: Array<string>}> {
  _renderTLFEntry = (index: number, tlf: string) => (
    <Kb.Box2 direction="horizontal" key={index} gap="tiny" fullWidth={true} style={styles.row}>
      <Kb.Text type="BodySemibold">•</Kb.Text>
      <Kb.Text type="BodySemibold" selectable={true} style={styles.tlf}>
        {tlf}
      </Kb.Text>
    </Kb.Box2>
  )
  render() {
    if (!this.props.endangeredTLFs.length) return null
    return (
      <>
        <Kb.Text center={true} type="Body">
          You may lose access to these folders forever:
        </Kb.Text>
        <Kb.Box2 direction="vertical" style={styles.listContainer}>
          <Kb.List items={this.props.endangeredTLFs} renderItem={this._renderTLFEntry} indexAsKey={true} />
        </Kb.Box2>
      </>
    )
  }
}

const ActionButtons = ({onCancel, onSubmit}: {onCancel: () => void; onSubmit: () => void}) => (
  <Kb.Box2
    direction={Kb.Styles.isMobile ? 'vertical' : 'horizontalReverse'}
    fullWidth={Kb.Styles.isMobile}
    gap="tiny"
  >
    <Kb.WaitingButton
      fullWidth={Kb.Styles.isMobile}
      type="Danger"
      label="Yes, delete it"
      waitingKey={C.Devices.waitingKey}
      onClick={onSubmit}
    />
    <Kb.Button fullWidth={Kb.Styles.isMobile} type="Dim" onClick={onCancel} label="Cancel" />
  </Kb.Box2>
)

const getIcon = (deviceType: T.Devices.DeviceType, iconNumber: T.Devices.IconNumber) => {
  let iconType: Kb.IconType
  const size = Kb.Styles.isMobile ? 64 : 48
  switch (deviceType) {
    case 'backup':
      iconType = `icon-paper-key-revoke-${size}`
      break
    case 'mobile':
      iconType = `icon-phone-revoke-background-${iconNumber}-${size}`
      break
    case 'desktop':
      iconType = `icon-computer-revoke-background-${iconNumber}-${size}`
      break
  }
  if (Kb.isValidIconType(iconType)) {
    return iconType
  }
  return Kb.Styles.isMobile ? 'icon-computer-revoke-64' : 'icon-computer-revoke-48'
}

const loadEndangeredTLF = async (actingDevice: string, targetDevice: string) => {
  if (!actingDevice || !targetDevice) {
    return []
  }
  try {
    const tlfs = await T.RPCGen.rekeyGetRevokeWarningRpcPromise(
      {actingDevice, targetDevice},
      C.Devices.waitingKey
    )
    return tlfs.endangeredTLFs?.map(t => t.name) ?? []
  } catch (e) {
    console.error(e)
  }
  return []
}

const useRevoke = (deviceID = '') => {
  const d = C.useDevicesState(s => s.deviceMap.get(deviceID))
  const load = C.useDevicesState(s => s.dispatch.load)
  const username = C.useCurrentUserState(s => s.username)
  const wasCurrentDevice = d?.currentDevice ?? false
  const navUpToScreen = C.useRouterState(s => s.dispatch.navUpToScreen)
  const deviceName = d?.name ?? ''
  return React.useCallback(() => {
    const f = async () => {
      if (wasCurrentDevice) {
        try {
          await T.RPCGen.loginDeprovisionRpcPromise({doRevoke: true, username}, C.Devices.waitingKey)
          load()
          C.useConfigState.getState().dispatch.revoke(deviceName)
        } catch {}
      } else {
        try {
          await T.RPCGen.revokeRevokeDeviceRpcPromise(
            {deviceID, forceLast: false, forceSelf: false},
            C.Devices.waitingKey
          )
          load()
          C.useConfigState.getState().dispatch.revoke(deviceName)
          navUpToScreen(
            C.isMobile ? (C.isTablet ? C.Tabs.settingsTab : C.Settings.settingsDevicesTab) : C.Tabs.devicesTab
          )
        } catch {}
      }
    }
    C.ignorePromise(f())
  }, [navUpToScreen, deviceID, deviceName, load, username, wasCurrentDevice])
}

const DeviceRevoke = (ownProps: OwnProps) => {
  const selectedDeviceID = ownProps.deviceID
  const [endangeredTLFs, setEndangeredTLFs] = React.useState(new Array<string>())
  const device = C.useDevicesState(s => s.deviceMap.get(selectedDeviceID))
  const deviceID = device?.deviceID
  const deviceName = device?.name ?? ''
  const type = device?.type ?? 'desktop'
  const iconNumber = Constants.useDeviceIconNumber(selectedDeviceID)
  const waiting = C.Waiting.useAnyWaiting(C.Devices.waitingKey)
  const onSubmit = useRevoke(deviceID)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = navigateUp

  const actingDevice = C.useCurrentUserState(s => s.deviceID)
  C.useOnMountOnce(() => {
    const f = async () => {
      const tlfs = await loadEndangeredTLF(actingDevice, selectedDeviceID)
      setEndangeredTLFs(tlfs)
    }
    C.ignorePromise(f())
  })

  const props = {
    device,
    endangeredTLFs,
    iconNumber,
    onCancel,
    onSubmit,
    waiting,
  }
  return (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      gap="small"
      gapEnd={true}
      style={styles.container}
    >
      <Kb.NameWithIcon
        icon={getIcon(type, props.iconNumber)}
        title={deviceName}
        titleStyle={styles.headerName}
        size="small"
      />
      <Kb.Text center={true} type="Header">
        Are you sure you want to revoke{' '}
        {device?.currentDevice ? (
          'your current device'
        ) : (
          <Kb.Text type="Header" style={styles.italicName}>
            {deviceName}
          </Kb.Text>
        )}
        ?
      </Kb.Text>
      <Kb.Box2 direction="vertical" style={styles.endangeredTLFContainer} fullWidth={Kb.Styles.isMobile}>
        {!props.waiting && <EndangeredTLFList endangeredTLFs={props.endangeredTLFs} />}
      </Kb.Box2>
      <ActionButtons onCancel={props.onCancel} onSubmit={props.onSubmit} />
      {props.waiting && (
        <Kb.Text center={true} type="BodySmallItalic">
          Calculating any side effects...
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {padding: Kb.Styles.globalMargins.small},
      endangeredTLFContainer: Kb.Styles.platformStyles({
        isElectron: {alignSelf: 'center'},
        isMobile: {flexGrow: 1},
      }),
      headerName: {
        color: Kb.Styles.globalColors.redDark,
        textDecorationLine: 'line-through',
      },
      italicName: {...Kb.Styles.globalStyles.italic},
      listContainer: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          alignContent: 'center',
          borderColor: Kb.Styles.globalColors.black_10,
          borderRadius: 4,
          borderStyle: 'solid',
          borderWidth: 1,
          flexGrow: 1,
          marginBottom: Kb.Styles.globalMargins.small,
          marginTop: Kb.Styles.globalMargins.small,
          width: '100%',
        },
        isElectron: {height: 162, width: 440},
      }),
      row: {
        paddingBottom: Kb.Styles.globalMargins.xxtiny,
        paddingLeft: Kb.Styles.globalMargins.xtiny,
        paddingTop: Kb.Styles.globalMargins.xxtiny,
      },
      tlf: Kb.Styles.platformStyles({
        isElectron: {wordBreak: 'break-word'} as const,
      }),
    }) as const
)

export default DeviceRevoke
