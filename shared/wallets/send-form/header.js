// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {onBack?: ?() => void, whiteBackground?: boolean}

const Header = (props: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.headerContainer} fullWidth={true}>
    <Kb.Box2
      direction="horizontal"
      style={Styles.collapseStyles([styles.header, props.whiteBackground && styles.whiteBackground])}
      fullWidth={true}
    >
      {props.onBack && <Kb.BackButton style={styles.backButton} onClick={props.onBack} />}
      <Kb.Icon type="icon-stellar-coins-flying-48" style={Kb.iconCastPlatformStyles(styles.icon)} />
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  backButton: {
    left: Styles.isMobile ? 4 : 16,
    position: 'absolute',
  },
  header: Styles.platformStyles({
    common: {
      alignSelf: 'flex-end',
      backgroundColor: Styles.globalColors.purple,
      justifyContent: 'center',
      position: 'relative',
      flexShrink: 0,
    },
    isElectron: {
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
    },
    isMobile: {
      height: 48,
    },
  }),
  headerContainer: Styles.platformStyles({
    isElectron: {
      height: 48,
    },
    isMobile: {
      height: 48,
    },
  }),
  icon: Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -9,
    },
  }),
  whiteBackground: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      borderBottomColor: Styles.globalColors.black_10,
      borderBottomWidth: 2,
    },
    isElectron: {
      borderBottomStyle: 'solid',
      borderBottomWidth: '1px',
    },
  }),
})

export default Header
