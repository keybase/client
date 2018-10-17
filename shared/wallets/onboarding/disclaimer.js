// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletPopup} from '../common'

type DisclaimerProps = {|
  onClose: () => void,
  setNextScreen: (screen: 'openWallet' | 'linkExisting') => void,
|}

type DisclaimerState = {|
  secondsLeft: number,
|}

class Disclaimer extends React.Component<DisclaimerProps, DisclaimerState> {
  state = {secondsLeft: 5}
  _setSecondsLeft = (secondsLeft: number) => this.setState({secondsLeft})

  render() {
    const buttons = [
      <Kb.Button key={0} type="Secondary" onClick={this.props.acceptDisclaimer} label="Yes, I agree" />,
      <Kb.Button key={1} type="Wallet" onClick={this.props.acceptDisclaimer} label="Not now" />,
    ]

    return (
      <WalletPopup
        bottomButtons={buttons}
        onClose={this.props.onClose}
        buttonBarDirection="column"
        containerStyle={styles.container}
      >
        <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} />
        <Kb.Text type="Header" style={styles.headerText}>
          Almost done.
        </Kb.Text>

        <Kb.Text type="Header" style={styles.headerText}>
          It's important you read this.
        </Kb.Text>

        <Kb.ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContentContainer}>
          <Kb.Text type="Body" style={styles.bodyText}>
            We believe Keybase can help make cryptocurrency usable for 2 reasons:
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            • we can make your Stellar private key sync with encryption across your devices, without exposing
            it to our servers. cool!
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            • we can help you send and receive crypto just by knowing usernames. You can say goodbye to ugly
            "addresses" you have to pass around insecurely.
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            And we believe Stellar is in{' '}
            <Kb.Text style={styles.bodyText} type="BodyItalic">
              a unique position
            </Kb.Text>{' '}
            to solve payments because:
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            • it's ultra fast and ultra cheap it doesn't burn more electricity than small nations
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            • it natively understands currencies and tokens
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            • the network itself has a decentralized exchange built into it
          </Kb.Text>
        </Kb.ScrollView>
      </WalletPopup>
    )
  }
}

const styles = Styles.styleSheetCreate({
  bodyText: {color: Styles.globalColors.white, marginBottom: Styles.globalMargins.small, textAlign: 'center'},
  container: {backgroundColor: Styles.globalColors.purple2},
  headerText: {
    color: Styles.globalColors.white,
  },
  scrollView: {
    marginTop: Styles.globalMargins.small,
  },
  scrollViewContentContainer: {...Styles.globalStyles.flexBoxColumn, flexGrow: 1},
})

export default Disclaimer
