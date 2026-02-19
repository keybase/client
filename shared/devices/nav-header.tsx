import * as C from '@/constants'
import type * as DevicesType from '@/stores/devices'
import * as Kb from '@/common-adapters'
import * as React from 'react'

export const HeaderTitle = () => {
  const Devices = require('@/stores/devices') as typeof DevicesType
  const numActive = Devices.useActiveDeviceCounts()
  const numRevoked = Devices.useRevokedDeviceCounts()
  return (
    <Kb.Box2 direction="vertical" style={styles.headerTitle}>
      <Kb.Text3 type="Header">Devices</Kb.Text3>
      <Kb.Text3 type="BodySmall">
        {numActive} Active • {numRevoked} Revoked
      </Kb.Text3>
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
