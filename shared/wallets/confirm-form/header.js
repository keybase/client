// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type HeaderProps = {|
  onBack: () => void,
  sendingIntentionXLM: boolean,
  displayAmountXLM: string,
  displayAmountFiat: string,
|}

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
    <Kb.BackButton
      onClick={props.onBack}
      style={styles.backButton}
      iconColor={Styles.globalColors.white}
      textStyle={styles.backButtonText}
    />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  backButton: Styles.platformStyles({
    common: {
      position: 'absolute',
    },
    isElectron: {
      left: Styles.globalMargins.small,
      top: Styles.globalMargins.small,
    },
    isMobile: {
      left: Styles.globalMargins.xtiny,
    },
  }),
  backButtonText: {
    color: Styles.globalColors.white,
  },
  header: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.purple,
    },
    isElectron: {
      flex: 1,
      minHeight: 144,
    },
    isMobile: {
      flexBasis: 'auto',
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 200,
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
