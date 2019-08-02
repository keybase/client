import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletBackButton} from '../common'

type HeaderProps = {
  onBack: () => void
  sendingIntentionXLM: boolean
  displayAmountXLM: string
  displayAmountFiat: string
  showCancelInsteadOfBackOnMobile: boolean
}

const Header = (props: HeaderProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header}>
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.headerContent}>
      <Kb.Icon
        type={
          Styles.isMobile
            ? 'icon-fancy-stellar-sending-mobile-149-129'
            : 'icon-fancy-stellar-sending-desktop-98-86'
        }
        style={Kb.iconCastPlatformStyles(styles.headerIcon)}
      />
      <Kb.Text selectable={true} type="BodyTiny" style={styles.headerText}>
        {(props.sendingIntentionXLM ? 'Sending' : 'Sending Lumens worth').toUpperCase()}
      </Kb.Text>
      <Kb.Text selectable={true} type="HeaderBigExtrabold" style={styles.headerText}>
        {props.sendingIntentionXLM ? props.displayAmountXLM : props.displayAmountFiat}
      </Kb.Text>
      {props.sendingIntentionXLM && !!props.displayAmountFiat && (
        <Kb.Text selectable={true} type="BodyTiny" style={styles.headerText}>
          {'(APPROXIMATELY ' + props.displayAmountFiat + ')'}
        </Kb.Text>
      )}
    </Kb.Box2>
    <WalletBackButton
      onBack={props.onBack}
      showCancelInsteadOfBackOnMobile={props.showCancelInsteadOfBackOnMobile}
    />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  header: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.purpleDark,
    },
    isElectron: {
      flex: 1,
      minHeight: 160,
    },
    isMobile: {
      flexBasis: 'auto',
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 250,
    },
  }),
  headerContent: Styles.platformStyles({
    isElectron: {
      marginTop: -20,
    },
  }),
  headerIcon: {
    marginBottom: Styles.globalMargins.small,
  },
  headerText: {
    color: Styles.globalColors.white,
  },
})

export default Header
