import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type HeaderTitleProps = {
  numActive: number
  numRevoked: number
}

export const HeaderTitle = (props: HeaderTitleProps) => (
  <Kb.Box2 direction="vertical" style={styles.headerTitle}>
    <Kb.Text type="Header">Devices</Kb.Text>
    <Kb.Text type="BodySmall">
      {props.numActive} Active • {props.numRevoked} Revoked
    </Kb.Text>
  </Kb.Box2>
)

export const HeaderRightActions = ({onAdd}: {onAdd: () => void}) => (
  <Kb.Button small={true} label="Add device or paper key" onClick={onAdd} style={styles.addDeviceButton} />
)

const styles = Styles.styleSheetCreate({
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
})
