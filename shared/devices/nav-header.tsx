import * as C from '@/constants'
import * as Constants from '@/constants/devices'
import * as Kb from '@/common-adapters'
import * as React from 'react'

export const HeaderTitle = () => {
  const numActive = Constants.useActiveDeviceCounts()
  const numRevoked = Constants.useRevokedDeviceCounts()
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
