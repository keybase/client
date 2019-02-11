// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/wallets'
import * as Styles from '../../styles'
import {WalletPopup} from '../common'

type IntroProps = {|
  onClose: () => void,
  setNextScreen: (nextScreen: Types.NextScreenAfterAcceptance) => void,
|}

const Intro = (props: IntroProps) => {
  const buttons = [
    <Kb.Button
      style={styles.buttonStyle}
      fullWidth={true}
      key={0}
      type="Secondary"
      onClick={() => props.setNextScreen('openWallet')}
      label="Open your wallet"
      labelStyle={styles.labelStyle}
    >
      <Kb.Icon style={Kb.iconCastPlatformStyles(styles.icon)} type="icon-wallet-open-48" />
    </Kb.Button>,
  ]
  return (
    <WalletPopup
      bottomButtons={buttons}
      backButtonType="close"
      onExit={props.onClose}
      buttonBarDirection="column"
      containerStyle={styles.background}
      headerStyle={styles.background}
      safeAreaViewBottomStyle={styles.background}
      safeAreaViewTopStyle={styles.background}
      theme="dark"
    >
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.container}>
        <Kb.Text center={true} type="Header" style={styles.headerText}>
          Keybase supports Stellar wallets
        </Kb.Text>

        <Kb.Text center={true} type="Body" style={styles.bodyText}>
          You can now send or request Stellar Lumens to any Keybase user on{' '}
          <Kb.Text center={true} type="BodyExtrabold" style={styles.bodyText}>
            Earth
          </Kb.Text>
          . Transactions settle in seconds, and cost a fraction of a penny.
        </Kb.Text>

        <Kb.Text center={true} type="Body" style={styles.bodyText}>
          When sending and receiving Lumens, we automatically do the conversion in your favorite currency. We
          went ahead and set it to{' '}
          <Kb.Text center={true} type="BodyExtrabold" style={styles.bodyText}>
            USD
          </Kb.Text>
          .
        </Kb.Text>

        <Kb.Icon style={styles.illustration} type="icon-illustration-stellar-payments-200-188" />
      </Kb.Box2>
    </WalletPopup>
  )
}

const styles = Styles.styleSheetCreate({
  background: {
    backgroundColor: Styles.globalColors.purple2,
    borderBottomWidth: 0,
  },
  bodyText: {
    color: Styles.globalColors.white,
    marginBottom: Styles.globalMargins.tiny,
  },
  buttonLabelStyle: {color: Styles.globalColors.purple},
  buttonStyle: {
    backgroundColor: Styles.globalColors.white,
    marginBottom: Styles.globalMargins.large,
    width: '100%',
  },
  container: {
    flex: 1,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
  },
  headerText: {
    color: Styles.globalColors.white,
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.medium,
  },
  icon: {
    marginRight: Styles.globalMargins.tiny,
    position: 'relative',
    top: -10,
  },
  illustration: Styles.platformStyles({
    isElectron: {
      paddingBottom: Styles.globalMargins.mediumLarge,
    },
    isMobile: {
      marginBottom: 100,
      marginTop: 50,
    },
  }),
  labelStyle: {
    color: Styles.globalColors.purple,
  },
})

export default Intro
