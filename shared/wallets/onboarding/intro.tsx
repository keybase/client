import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletPopup} from '../common'

type IntroProps = {
  headerBody: string
  headerTitle: string
  onClose: () => void
  onSeenIntro: () => void
}

const Intro = (props: IntroProps) => {
  const buttons = [
    <Kb.Button
      style={Styles.collapseStyles([styles.buttonStyle, {backgroundColor: Styles.globalColors.white}])}
      fullWidth={true}
      key={0}
      type="Dim"
      onClick={props.onSeenIntro}
      label="Open your wallet"
      labelStyle={styles.labelStyle}
    />,
  ]
  return (
    <WalletPopup
      bottomButtons={buttons}
      backButtonType="close"
      onExit={props.onClose}
      buttonBarDirection="column"
      containerStyle={styles.container}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
        <Kb.Text center={true} type="Header" style={styles.headerText}>
          {props.headerTitle || 'Keybase supports Stellar wallets.'}
        </Kb.Text>

        <Kb.Markdown styleOverride={bodyOverride} style={styles.bodyText}>
          {props.headerBody ||
            'You can now send or request Stellar Lumens to any Keybase user on *Earth*. Transactions settle in seconds, and cost a fraction of a penny.\n\nWhen sending and receiving Lumens, we automatically do the conversion in your favorite currency. We went ahead and set it to *USD*.'}
        </Kb.Markdown>

        <Kb.Icon
          color={Styles.globalColors.black}
          style={Kb.iconCastPlatformStyles(styles.illustration)}
          type="icon-illustration-stellar-payments-200-188"
        />
      </Kb.Box2>
    </WalletPopup>
  )
}

const bodyOverride = {
  paragraph: {
    color: Styles.globalColors.white,
    fontSize: Styles.isMobile ? 16 : 13,
    textAlign: Styles.isMobile ? ('center' as const) : ('left' as const),
  },
  strong: Styles.globalStyles.fontExtrabold,
}

const styles = Styles.styleSheetCreate({
  bodyText: {color: Styles.globalColors.white, marginBottom: Styles.globalMargins.xsmall},
  buttonLabelStyle: {color: Styles.globalColors.purpleDark},
  buttonStyle: {width: '100%'},
  container: {backgroundColor: Styles.globalColors.purple, padding: Styles.globalMargins.medium},
  headerText: {
    color: Styles.globalColors.white,
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.medium,
  },
  icon: {
    position: 'relative',
    top: -10,
  },
  illustration: {
    paddingBottom: Styles.globalMargins.mediumLarge,
  },
  labelStyle: {
    color: Styles.globalColors.purpleDark,
  },
})

export default Intro
