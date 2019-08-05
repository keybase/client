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
          {props.headerTitle}
        </Kb.Text>

        <Kb.Markdown style={styles.bodyText}>{props.headerBody}</Kb.Markdown>

        <Kb.Icon
          color={Styles.globalColors.black}
          style={Kb.iconCastPlatformStyles(styles.illustration)}
          type="icon-illustration-stellar-payments-200-188"
        />
      </Kb.Box2>
    </WalletPopup>
  )
}

const styles = Styles.styleSheetCreate({
  bodyText: {color: Styles.globalColors.white, marginBottom: Styles.globalMargins.tiny},
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
