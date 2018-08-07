// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type HeaderProps = {|
  onBack: () => void,
  amount: string,
  assetType: string,
  assetConversion?: string,
|}

const Header = (props: HeaderProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header}>
    <Kb.BackButton
      onClick={props.onBack}
      style={styles.backButton}
      iconColor={Styles.globalColors.white}
      textStyle={styles.backButtonText}
    />
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      centerChildren={true}
      style={styles.headerContent}
    >
      <Kb.Icon
        type={Styles.isMobile ? 'icon-fancy-stellar-sending-desktop' : 'icon-fancy-stellar-sending-mobile'}
        style={Kb.iconCastPlatformStyles(styles.headerIcon)}
      />
      <Kb.Text type="BodySmall" style={styles.headerText}>
        {/* {`Sending ${!!props.assetConversion && props.assetType} worth`.toUpperCase()} */}
        {`Sending`.toUpperCase()}
      </Kb.Text>
      <Kb.Text type="HeaderBigExtrabold" style={styles.headerText}>
        {props.assetConversion ? props.assetConversion : props.amount}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  header: Styles.platformStyles({
    common: {
      flex: 1,
      backgroundColor: Styles.globalColors.purple,
    },
    isElectron: {
      minHeight: 144,
    },
  }),
  headerContent: Styles.platformStyles({
    isElectron: {
      marginTop: -20,
    },
  }),
  headerText: {
    color: Styles.globalColors.white,
  },
  headerIcon: {
    width: 100,
    marginBottom: Styles.globalMargins.small,
  },
  backButton: {
    position: 'absolute',
    top: Styles.globalMargins.small,
    left: Styles.globalMargins.small,
  },
  backButtonText: {
    color: Styles.globalColors.white,
  },
})

export default Header
