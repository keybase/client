import * as C from '@/constants'
import {useConfigState} from '@/stores/config'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {settingsDevicesTab} from '@/constants/settings'
import {useCurrentUserState} from '@/stores/current-user'
import {rpcDeviceDetailToDevice} from './common'
import {getDeviceRevokeIconType} from './device-icon'

type DeviceRevokeProps = {device?: T.Devices.Device; deviceID?: T.Devices.DeviceID}

const renderTLFEntry = (index: number, tlf: string) => (
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
      <Kb.ScrollView style={styles.listContainer}>
        {props.endangeredTLFs.map((tlf, index) => renderTLFEntry(index, tlf))}
      </Kb.ScrollView>
    </>
  )
}

const ActionButtons = ({onCancel, onSubmit}: {onCancel: () => void; onSubmit: () => void}) => (
  <Kb.Box2 direction={isMobile ? 'vertical' : 'horizontalReverse'} fullWidth={isMobile} gap="tiny">
    <Kb.WaitingButton
      fullWidth={isMobile}
      type="Danger"
      label="Yes, delete it"
      waitingKey={C.waitingKeyDevices}
      onClick={onSubmit}
    />
    <Kb.Button fullWidth={isMobile} type="Dim" onClick={onCancel} label="Cancel" />
  </Kb.Box2>
)

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

const revokeDevice = async (
  username: string,
  wasCurrentDevice: boolean,
  deviceID: T.Devices.DeviceID,
  deviceName: string
) => {
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
      C.Router2.navUpToScreen(isMobile ? settingsDevicesTab : 'devicesRoot')
    } catch {}
  }
}

const useRevoke = (device: T.Devices.Device) => {
  const username = useCurrentUserState(s => s.username)
  const wasCurrentDevice = device.currentDevice
  const deviceID = device.deviceID
  const deviceName = device.name
  return () => {
    C.ignorePromise(revokeDevice(username, wasCurrentDevice, deviceID, deviceName))
  }
}

const DeviceRevoke = (ownProps: DeviceRevokeProps) => {
  const loadDeviceHistory = C.useRPC(T.RPCGen.deviceDeviceHistoryListRpcPromise)
  const navigateUp = C.Router2.navigateUp
  const selectedDeviceID = ownProps.device?.deviceID ?? ownProps.deviceID ?? T.Devices.stringToDeviceID('')
  const [loadedDevice, setLoadedDevice] = React.useState<T.Devices.Device | undefined>()
  const device = ownProps.device ?? (loadedDevice?.deviceID === selectedDeviceID ? loadedDevice : undefined)
  const [endangeredTLFs, setEndangeredTLFs] = React.useState(new Array<string>())
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyDevices)
  const onCancel = navigateUp

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
          ?.map(rpcDeviceDetailToDevice)
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
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} centerChildren={true} padding="small">
        <Kb.ProgressIndicator />
      </Kb.Box2>
    )
  }

  const type = device.type
  const iconNumber = T.Devices.deviceNumberToIconNumber(device.deviceNumberOfType)

  return (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      gap="small"
      gapEnd={true}
      padding="small"
    >
      <Kb.NameWithIcon
        icon={getDeviceRevokeIconType(type, iconNumber)}
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
      <Kb.Box2 direction="vertical" style={styles.endangeredTLFContainer} fullWidth={isMobile}>
        {!waiting && <EndangeredTLFList endangeredTLFs={endangeredTLFs} />}
      </Kb.Box2>
      <ActionButtons onCancel={onCancel} onSubmit={onSubmit} />
      {waiting && (
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
      endangeredTLFContainer: Kb.Styles.platformStyles({
        isElectron: {alignSelf: 'center'},
        isMobile: {...Kb.Styles.globalStyles.flexGrow},
      }),
      headerName: {
        color: Kb.Styles.globalColors.redDark,
        textDecorationLine: 'line-through',
      },
      italicName: {...Kb.Styles.globalStyles.italic},
      listContainer: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.border(Kb.Styles.globalColors.black_10, 1, Kb.Styles.borderRadius),
          flexGrow: 1,
          ...Kb.Styles.marginV(Kb.Styles.globalMargins.small),
        },
        isElectron: {height: 162, width: 440},
      }),
      row: {
        ...Kb.Styles.paddingV(Kb.Styles.globalMargins.xxtiny),
        paddingLeft: Kb.Styles.globalMargins.xtiny,
      },
      tlf: Kb.Styles.platformStyles({
        isElectron: {wordBreak: 'break-word'} as const,
      }),
    }) as const
)

export default DeviceRevoke
