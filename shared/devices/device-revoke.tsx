import * as C from '@/constants'
import {useConfigState} from '@/stores/config'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {settingsDevicesTab} from '@/constants/settings'
import {useCurrentUserState} from '@/stores/current-user'

type OwnProps = {device?: T.Devices.Device; deviceID?: T.Devices.DeviceID}

const _renderTLFEntry = (index: number, tlf: string) => (
  <Kb.Box2 direction="horizontal" key={index} gap="tiny" fullWidth={true} style={styles.row}>
    <Kb.Text type="BodySemibold">•</Kb.Text>
    <Kb.Text type="BodySemibold" selectable={true} style={styles.tlf}>
      {tlf}
    </Kb.Text>
  </Kb.Box2>
)
const EndangeredTLFList = (props: {endangeredTLFs: Array<string>}) => {
  if (!props.endangeredTLFs.length) return null
  return (
    <>
      <Kb.Text center={true} type="Body">
        You may lose access to these folders forever:
      </Kb.Text>
      <Kb.Box2 direction="vertical" style={styles.listContainer}>
        <Kb.List
          items={props.endangeredTLFs}
          renderItem={_renderTLFEntry}
          indexAsKey={true}
          itemHeight={{height: 24, type: 'fixed'}}
        />
      </Kb.Box2>
    </>
  )
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
      waitingKey={C.waitingKeyDevices}
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

const loadEndangeredTLF = async (actingDevice: string, targetDevice: string) => {
  if (!actingDevice || !targetDevice) {
    return []
  }
  try {
    const tlfs = await T.RPCGen.rekeyGetRevokeWarningRpcPromise(
      {actingDevice, targetDevice},
      C.waitingKeyDevices
    )
    return tlfs.endangeredTLFs?.map(t => t.name) ?? []
  } catch (e) {
    console.error(e)
  }
  return []
}

const useRevoke = (device: T.Devices.Device) => {
  const username = useCurrentUserState(s => s.username)
  const wasCurrentDevice = device.currentDevice
  const navUpToScreen = C.Router2.navUpToScreen
  const deviceID = device.deviceID
  const deviceName = device.name
  return () => {
    const f = async () => {
      if (wasCurrentDevice) {
        try {
          await T.RPCGen.loginDeprovisionRpcPromise({doRevoke: true, username}, C.waitingKeyDevices)
          useConfigState.getState().dispatch.revoke(deviceName, wasCurrentDevice)
        } catch {}
      } else {
        try {
          await T.RPCGen.revokeRevokeDeviceRpcPromise(
            {deviceID, forceLast: false, forceSelf: false},
            C.waitingKeyDevices
          )
          useConfigState.getState().dispatch.revoke(deviceName, wasCurrentDevice)
          navUpToScreen(C.isMobile ? settingsDevicesTab : 'devicesRoot')
        } catch {}
      }
    }
    C.ignorePromise(f())
  }
}

const DeviceRevoke = (ownProps: OwnProps) => {
  const loadDeviceHistory = C.useRPC(T.RPCGen.deviceDeviceHistoryListRpcPromise)
  const navigateUp = C.Router2.navigateUp
  const selectedDeviceID = ownProps.device?.deviceID ?? ownProps.deviceID ?? T.Devices.stringToDeviceID('')
  const [loadedDevice, setLoadedDevice] = React.useState(ownProps.device)
  const device = ownProps.device ?? loadedDevice
  const [endangeredTLFs, setEndangeredTLFs] = React.useState(new Array<string>())
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyDevices)
  const onCancel = navigateUp

  React.useEffect(() => {
    setLoadedDevice(ownProps.device)
  }, [ownProps.device])

  C.useOnMountOnce(() => {
    if (device) {
      return
    }
    if (!selectedDeviceID) {
      navigateUp()
      return
    }
    loadDeviceHistory(
      [undefined, C.waitingKeyDevices],
      results => {
        const hydratedDevice = results
          ?.map(rpcDeviceToDevice)
          .find(candidate => candidate.deviceID === selectedDeviceID)
        if (hydratedDevice) {
          setLoadedDevice(hydratedDevice)
        } else {
          navigateUp()
        }
      },
      _ => {
        navigateUp()
      }
    )
  })

  const onSubmit = useRevoke(
    device ?? {
      created: 0,
      currentDevice: false,
      deviceID: selectedDeviceID,
      deviceNumberOfType: 0,
      lastUsed: 0,
      name: '',
      type: 'desktop',
    }
  )

  const actingDevice = useCurrentUserState(s => s.deviceID)
  C.useOnMountOnce(() => {
    if (!selectedDeviceID) {
      return
    }
    const f = async () => {
      const tlfs = await loadEndangeredTLF(actingDevice, selectedDeviceID)
      setEndangeredTLFs(tlfs)
    }
    C.ignorePromise(f())
  })

  if (!device) {
    return (
      <Kb.Box2
        direction="vertical"
        fullHeight={true}
        fullWidth={true}
        centerChildren={true}
        style={styles.container}
      >
        <Kb.ProgressIndicator />
      </Kb.Box2>
    )
  }

  const type = device.type
  const iconNumber = T.Devices.deviceNumberToIconNumber(device.deviceNumberOfType)

  const props = {
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
        title={device.name}
        titleStyle={styles.headerName}
        size="small"
      />
      <Kb.Text center={true} type="Header">
        Are you sure you want to revoke{' '}
        {device.currentDevice ? (
          'your current device'
        ) : (
          <Kb.Text type="Header" style={styles.italicName}>
            {device.name}
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
