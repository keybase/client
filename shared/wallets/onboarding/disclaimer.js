// @flow
import * as React from 'react'
import * as Constants from '../../constants/wallets'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletPopup} from '../common'
import {addTicker, removeTicker, type TickerID} from '../../util/second-timer'

type DisclaimerProps = {|
  onAcceptDisclaimer: () => void,
  onNotNow: () => void,
|}

type DisclaimerState = {|
  secondsLeft: number,
|}

class Disclaimer extends React.Component<DisclaimerProps, DisclaimerState> {
  state = {secondsLeft: 5}
  timer: ?TickerID = null

  tick = () => {
    this.setState({secondsLeft: this.state.secondsLeft - 1}, () => {
      if (this.state.secondsLeft === 0 && this.timer) {
        removeTicker(this.timer)
      }
    })
  }

  componentWillUnmount() {
    if (!__STORYBOOK__) {
      this.timer && removeTicker(this.timer)
    }
  }

  componentDidMount() {
    if (!__STORYBOOK__) {
      this.timer = addTicker(this.tick)
    }
  }

  render() {
    const label = 'Yes, I agree'.concat(this.state.secondsLeft ? ` (${this.state.secondsLeft})` : '')
    const buttons = [
      <Kb.WaitingButton
        style={Styles.collapseStyles([styles.buttonStyle, {backgroundColor: Styles.globalColors.white}])}
        waitingKey={Constants.acceptDisclaimerWaitingKey}
        disabled={this.state.secondsLeft > 0}
        key={0}
        fullWidth={true}
        type="Secondary"
        onClick={this.props.onAcceptDisclaimer}
        label={label}
      />,
      <Kb.Button
        style={styles.buttonStyle}
        key={1}
        fullWidth={true}
        type="SecondaryColoredBackground"
        onClick={this.props.onNotNow}
        label="Not now"
      />,
    ]

    return (
      <WalletPopup
        bottomButtons={buttons}
        onExit={this.props.onNotNow}
        backButtonType="close"
        buttonBarDirection="column"
        containerStyle={styles.container}
        buttonBarStyle={styles.buttonBar}
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
            • it's ultra fast and ultra cheap
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            • it natively understands currencies and tokens
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            • the network itself has a decentralized exchange built into it
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            • it doesn't burn more electricity than small nations
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            But there are a few things you must agree to understand before using Stellar on Keybase:
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            1. IT'S BRAND NEW AND YOU ARE AMONG ITS FIRST TESTERS. Seriously, don't race off and buy more
            cryptocurrency than you're willing to lose. And don't manage tokens in Keybase that you're not
            willing to lose. We could have an exploitable bug in an early release. You're using this app at
            your own risk.{' '}
            <Kb.Text type="BodyExtrabold" style={styles.bodyText}>
              Keybase will not reimburse for any lost cryptocurrency due to user error or Keybase error of any
              kind.
            </Kb.Text>
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            2. BY DESIGN, WE CAN'T RECOVER YOUR PRIVATE KEY. We don't actually hold your funds, we simply help
            you encrypt your keys. If you lose all your Keybase installs and paper keys, and if you haven't
            backed up your Stellar private key, you'll lose your Stellar account. Knowing your Keybase
            password is not enough info. Similarly, knowing your PGP private key isn't enough info. You must
            have access to a Keybase install (logged in as you) or Keybase paper key to recover your Stellar
            private key.
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            3. CRYPTOCURRENCY ISN'T REALLY ANONYMOUS. When you sign your first or "default" Stellar address
            into your signature chain on Keybase, you are announcing it publicly as a known address for you.
            Assume that all your transactions from that account are public. You can have as many Stellar
            accounts as you like in Keybase, but whenever you make one your default, that one is then
            announced as yours. Consider that data permanent.{' '}
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            4. DON'T "RESET" YOUR KEYBASE ACCOUNT. If you reset your Keybase account, that will let you
            recover your Keybase username, by killing all your keys. You'll lose your Stellar account in
            Keybase. So don't do a Keybase account reset unless you've backed up your Stellar private key(s).{' '}
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            5. AVOID SOCIAL ATTACKS. People may beg of thee for thine cryptocurrency. Pay attention to
            usernames, not photos and full names. Follow people on Keybase, so they turn green, which is a
            cryptographically signed action. And don't ever install software that other people send you, even
            if you trust those people. That software may be some kind of social worm. Keybase cannot be
            responsible for lost tokens due to bugs, hacks, or social attacks. Or anything else for that
            matter.{' '}
          </Kb.Text>

          <Kb.Text type="Body" style={styles.bodyText}>
            6. FINALLY HAVE FUN WHILE YOU CAN. Something is coming.
          </Kb.Text>
        </Kb.ScrollView>

        <Kb.Box style={styles.gradient} />
      </WalletPopup>
    )
  }
}

const styles = Styles.styleSheetCreate({
  bodyText: {
    color: Styles.globalColors.white,
    marginBottom: Styles.globalMargins.small,
    textAlign: 'left',
  },
  buttonBar: Styles.platformStyles({
    isElectron: {
      minHeight: 40,
    },
  }),
  buttonLabelStyle: {color: Styles.globalColors.purple},
  buttonStyle: {width: '100%'},
  container: {
    backgroundColor: Styles.globalColors.purple2,
    padding: Styles.globalMargins.medium,
  },
  gradient: Styles.platformStyles({
    isElectron: {
      backgroundImage: `linear-gradient(to bottom, ${Styles.globalColors.purple2_01}, ${
        Styles.globalColors.purple2
      })`,
      height: Styles.globalMargins.large,
      position: 'relative',
      top: -30,
      width: '100%',
    },
  }),
  headerText: {
    color: Styles.globalColors.white,
  },
  scrollView: {
    marginBottom: 0,
    marginTop: Styles.globalMargins.small,
  },
  scrollViewContentContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
    },
    isElectron: {
      height: 300,
    },
  }),
})

export default Disclaimer
