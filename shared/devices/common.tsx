import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'

export const HeaderTitle = ({activeCount, revokedCount}: {activeCount: number; revokedCount: number}) => (
  <Kb.Box2 direction="vertical" style={headerStyles.headerTitle}>
    <Kb.Text type="Header">Devices</Kb.Text>
    <Kb.Text type="BodySmall">
      {activeCount} Active • {revokedCount} Revoked
    </Kb.Text>
  </Kb.Box2>
)

const headerStyles = Kb.Styles.styleSheetCreate(() => ({
  headerTitle: {
    paddingBottom: Kb.Styles.globalMargins.xtiny,
    paddingLeft: Kb.Styles.globalMargins.xsmall,
  },
}))

export const rpcDeviceDetailToDevice = (d: T.RPCGen.DeviceDetail): T.Devices.Device => ({
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
