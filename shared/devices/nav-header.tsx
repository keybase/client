import * as C from '@/constants'
import * as Devices from '@/stores/devices'
import * as Kb from '@/common-adapters'
import * as React from 'react'

export const HeaderTitle = () => {
  const deviceMap = Devices.useLoadDevices()
  const devices = [...deviceMap.values()]
  const numActive = devices.reduce((c, v) => (!v.revokedAt ? c + 1 : c), 0)
  const numRevoked = devices.reduce((c, v) => (v.revokedAt ? c + 1 : c), 0)
  return (
    <Kb.Box2 direction="vertical" style={styles.headerTitle}>
      <Kb.Text type="Header">Devices</Kb.Text>
      <Kb.Text type="BodySmall">
        {numActive} Active • {numRevoked} Revoked
      </Kb.Text>
    </Kb.Box2>
  )
}

export const HeaderRightActions = () => {
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onAdd = React.useCallback(() => navigateAppend('deviceAdd'), [navigateAppend])
  return (
    <Kb.Button
      small={true}
      label="Add a device or paper key"
      onClick={onAdd}
      style={styles.addDeviceButton}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  addDeviceButton: Kb.Styles.platformStyles({
    common: {
      alignSelf: 'flex-end',
      marginBottom: 6,
      marginRight: Kb.Styles.globalMargins.xsmall,
    },
    isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
  }),
  headerTitle: {
    paddingBottom: Kb.Styles.globalMargins.xtiny,
    paddingLeft: Kb.Styles.globalMargins.xsmall,
  },
}))
