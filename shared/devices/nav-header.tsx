import * as RouterConstants from '../constants/router2'
import * as Constants from '../constants/devices'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'

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
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onAdd = React.useCallback(() => navigateAppend({props: {}, selected: 'deviceAdd'}), [navigateAppend])
  return (
    <Kb.Button
      small={true}
      label="Add a device or paper key"
      onClick={onAdd}
      style={styles.addDeviceButton}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  addDeviceButton: Styles.platformStyles({
    common: {
      alignSelf: 'flex-end',
      marginBottom: 6,
      marginRight: Styles.globalMargins.xsmall,
    },
    isElectron: Styles.desktopStyles.windowDraggingClickable,
  }),
  headerTitle: {
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.xsmall,
  },
}))
