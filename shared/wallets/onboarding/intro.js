// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletPopup} from '../common'

type IntroProps = {|
  onClose: () => void,
  setNextScreen: (nextScreen: string) => void,
|}

const Intro = (props: IntroProps) => {
  const buttons = [
    <Kb.Button
      key={0}
      type="Secondary"
      onClick={() => props.setNextScreen('openWallet')}
      label="Open your wallet"
    />,
    <Kb.Button
      key={1}
      type="Wallet"
      onClick={() => props.setNextScreen('linkExisting')}
      label="Link an existing Stellar account"
    />,
  ]
  return (
    <WalletPopup
      bottomButtons={buttons}
      onClose={props.onClose}
      buttonBarDirection="column"
      containerStyle={styles.container}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
        <Kb.Text type="Header" style={styles.headerText}>
          Keybase supports Stellar wallets
        </Kb.Text>

        <Kb.Text type="Body" style={styles.bodyText}>
          You can now send or request Stellar Lumens to any Keybase user on{' '}
          <Kb.Text type="BodyExtrabold" style={styles.bodyText}>
            Earth
          </Kb.Text>
          . Transactions settle in seconds, and cost a fraction of a penny.
        </Kb.Text>

        <Kb.Text type="Body" style={styles.bodyText}>
          When sending and receiving Lumens, we automatically do the conversion in your favorite currency. We
          went ahead and set it to{' '}
          <Kb.Text type="BodyExtrabold" style={styles.bodyText}>
            USD
          </Kb.Text>
          .
        </Kb.Text>
      </Kb.Box2>
    </WalletPopup>
  )
}

const styles = Styles.styleSheetCreate({
  bodyText: {color: Styles.globalColors.white, marginBottom: Styles.globalMargins.small, textAlign: 'center'},
  container: {backgroundColor: Styles.globalColors.purple2},
  headerText: {
    color: Styles.globalColors.white,
    marginBottom: Styles.globalMargins.medium,
  },
})

export default Intro
