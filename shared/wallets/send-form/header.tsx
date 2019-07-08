import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletBackButton} from '../common'

type Props = {
  isRequest: boolean
  children?: React.ReactNode
  onBack?: (() => void) | null
  showCancelInsteadOfBackOnMobile: boolean
  whiteBackground?: boolean
}

const Header = (props: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.headerContainer} fullWidth={true}>
    <Kb.Box2
      direction="horizontal"
      style={Styles.collapseStyles([styles.header, props.whiteBackground && styles.whiteBackground])}
      fullWidth={true}
      fullHeight={true}
      alignItems="center"
    >
      {props.onBack && (
        <WalletBackButton
          onBack={props.onBack}
          isOnWhiteBackground={props.whiteBackground}
          showCancelInsteadOfBackOnMobile={props.showCancelInsteadOfBackOnMobile}
        />
      )}
      {props.children || (
        <Kb.Icon
          type={props.isRequest ? 'icon-stellar-coins-receiving-48' : 'icon-stellar-coins-sending-48'}
          style={Kb.iconCastPlatformStyles(styles.icon)}
        />
      )}
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  header: Styles.platformStyles({
    common: {
      alignSelf: 'flex-end',
      backgroundColor: Styles.globalColors.purpleDark,
      flexShrink: 0,
      justifyContent: 'center',
      position: 'relative',
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
