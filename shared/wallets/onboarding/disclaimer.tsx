import * as React from 'react'
import * as Constants from '../../constants/wallets'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import openURL from '../../util/open-url'
import {addTicker, removeTicker, type TickerID} from '../../util/second-timer'

type DisclaimerProps = {
  acceptDisclaimerError: string
  acceptingDisclaimerDelay: boolean
  onAcceptDisclaimer: () => void
  onCheckDisclaimer: () => void
  onNotNow: () => void
}

type DisclaimerState = {
  secondsLeftAfterAccept: number
  secondsLeftBeforeAccept: number
  tryAgain: boolean
}

class Disclaimer extends React.Component<DisclaimerProps, DisclaimerState> {
  state = {secondsLeftAfterAccept: 6, secondsLeftBeforeAccept: 6, tryAgain: false}
  afterTimer: TickerID | null = null
  beforeTimer: TickerID | null = null

  afterTick = () => {
    this.setState(
      s => ({secondsLeftAfterAccept: Math.max(0, s.secondsLeftAfterAccept - 1)}),
      () => {
        if (this.state.secondsLeftAfterAccept === 0 && this.afterTimer) {
          removeTicker(this.afterTimer)
          this.afterTimer = null
          this.props.onCheckDisclaimer()
        }
      }
    )
  }

  beforeTick = () => {
    this.setState(
      s => ({secondsLeftBeforeAccept: s.secondsLeftBeforeAccept - 1}),
      () => {
        if (this.state.secondsLeftBeforeAccept === 0 && this.beforeTimer) {
          removeTicker(this.beforeTimer)
        }
      }
    )
  }

  removeTimers = () => {
    if (!__STORYBOOK__) {
      this.afterTimer && removeTicker(this.afterTimer)
      this.beforeTimer && removeTicker(this.beforeTimer)
      this.afterTimer = null
      this.beforeTimer = null
    }
  }

  componentWillUnmount() {
    this.removeTimers()
  }

  componentDidMount() {
    if (!__STORYBOOK__) {
      this.beforeTimer = addTicker(this.beforeTick)
    }
  }

  componentDidUpdate(prevProps: DisclaimerProps) {
    if (this.props.acceptingDisclaimerDelay && !this.afterTimer && !this.props.acceptDisclaimerError) {
      // Start the after countdown
      this.afterTimer = addTicker(this.afterTick)
    }
    if (this.props.acceptDisclaimerError && !prevProps.acceptDisclaimerError) {
      // show 'try again' & reset timer
      this.removeTimers()
      this.setState({secondsLeftAfterAccept: 6, tryAgain: true})
    }
  }
  render() {
    const props = this.props
    const afterLabel = `Opening wallet...`.concat(
      this.state.secondsLeftAfterAccept ? ` (${this.state.secondsLeftAfterAccept})` : ''
    )
    const beforeLabel = this.state.tryAgain
      ? 'Try again'
      : 'Yes, I agree'.concat(
          this.state.secondsLeftBeforeAccept ? ` (${this.state.secondsLeftBeforeAccept})` : ''
        )
    const buttons = [
      <Kb.Button
        disabled={this.props.acceptingDisclaimerDelay}
        style={styles.notNowButtonStyle}
        key={2}
        fullWidth={true}
        backgroundColor="purple"
        mode="Secondary"
        onClick={this.props.onNotNow}
        label="Not now"
      />,
    ]
    buttons.unshift(
      this.props.acceptingDisclaimerDelay ? (
        <Kb.Button
          style={Styles.collapseStyles([styles.buttonStyle, {backgroundColor: Styles.globalColors.white}])}
          disabled={true}
          key={0}
          fullWidth={true}
          type="Dim"
          onClick={this.props.onCheckDisclaimer}
          label={afterLabel}
        />
      ) : (
        <Kb.WaitingButton
          style={Styles.collapseStyles([styles.buttonStyle, {backgroundColor: Styles.globalColors.white}])}
          waitingKey={Constants.acceptDisclaimerWaitingKey}
          disabled={this.state.secondsLeftBeforeAccept > 0}
          key={1}
          fullWidth={true}
          type="Dim"
          onClick={this.props.onAcceptDisclaimer}
          label={beforeLabel}
        />
      )
    )

    // xxx test error presentation
    return (
      <Kb.Modal
        mobileStyle={styles.background}
        header={
          Styles.isMobile
            ? {
                leftButton: (
                  <Kb.Text style={styles.closeLabelStyle} type="BodyBigLink" onClick={props.onNotNow}>
                    Close
                  </Kb.Text>
                ),
              }
            : undefined
        }
        footer={{
          content: (
            <>
              <Kb.ButtonBar direction="column" fullWidth={true}>
                {buttons}
              </Kb.ButtonBar>
              {!!this.props.acceptDisclaimerError && (
                <Kb.Banner inline={true} color="red">
                  <Kb.BannerParagraph bannerColor="red" content={this.props.acceptDisclaimerError} />
                </Kb.Banner>
              )}
            </>
          ),
          style: styles.background,
        }}
        onClose={props.onNotNow}
      >
        <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.container}>
          <Kb.Box2 direction="vertical" style={styles.header}>
            <Kb.Text center={true} type="Header" style={styles.headerText}>
              Almost done. Important warnings here!
            </Kb.Text>
          </Kb.Box2>
          {Styles.isMobile ? (
            <Kb.Box2 direction="vertical" style={styles.disclaimerContainer}>
              <StaticDisclaimer />
            </Kb.Box2>
          ) : (
            <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={{position: 'relative'}}>
              <Kb.ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollViewContentContainer}
              >
                <StaticDisclaimer />
              </Kb.ScrollView>
              <Kb.Box style={styles.gradient} />
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Modal>
    )
  }
}

const StaticDisclaimer = () => (
  <>
    <Kb.Text type="Body" style={styles.bodyText}>
      1. WHAT IS STELLAR? Stellar is an open financial network. Anyone can use Stellar to send payments, issue
      tokens, create smart contracts, store value, and other activities on the Stellar network. Stellar is
      powered by free, open-source software and is hosted by independent computers across the globe. No one
      entity can control the Stellar network.
    </Kb.Text>
    <Kb.Text type="Body" style={styles.bodyText}>
      2. WHAT IS A LUMEN? Lumens (also referred to as "XLM") are cryptocurrency that are the native asset of
      the Stellar network. Lumens are required to use the Stellar network: they’re needed for transaction
      fees, account maintenance fees, and more. Read more about how you can use Lumens here:{' '}
      <Kb.Text
        type="BodyPrimaryLink"
        onClick={() => openURL('https://www.stellar.org/lumens/')}
        style={styles.bodyText}
      >
        https://www.stellar.org/lumens/
      </Kb.Text>
      . Note that Lumens can always be used for the Stellar network, but their fiat value could be highly
      volatile.
    </Kb.Text>
    <Kb.Text type="Body" style={styles.bodyText}>
      3. BY DESIGN, WE CAN'T RECOVER YOUR PRIVATE KEY. We don't actually hold your funds, we simply help you
      encrypt your keys. If you lose all your Keybase installs and paper keys, and if you haven't backed up
      your Stellar private key, you'll lose your Stellar account. Knowing your Keybase password is not enough
      info. Similarly, knowing your PGP private key isn't enough info. You must have access to a Keybase
      install (logged in as you) or Keybase paper key to recover your Stellar private key.
    </Kb.Text>
    <Kb.Text type="Body" style={styles.bodyText}>
      4. CRYPTOCURRENCY ISN'T REALLY ANONYMOUS. When you sign your first or "default" Stellar address into
      your signature chain on Keybase, you are announcing it publicly as a known address for you. Assume that
      all your transactions from that account are public. You can have as many Stellar accounts as you like in
      Keybase, but whenever you make one your default, that one is then announced as yours. Consider that data
      permanent.
    </Kb.Text>
    <Kb.Text type="Body" style={styles.bodyText}>
      5. DON'T "RESET" YOUR KEYBASE ACCOUNT. If you reset your Keybase account, that will let you recover your
      Keybase username, by killing all your keys. You'll lose your Stellar account in Keybase. So don't do a
      Keybase account reset unless you've backed up your Stellar private key(s).
    </Kb.Text>
    <Kb.Text type="Body" style={styles.bodyText}>
      6. AVOID SOCIAL ATTACKS. People may beg of thee for thine cryptocurrency. Pay attention to usernames,
      not photos and full names. Follow people on Keybase, so they turn green, which is a cryptographically
      signed action. And don't ever install software that other people send you, even if you trust those
      people. That software may be some kind of social worm. Keybase cannot be responsible for lost tokens due
      to bugs, hacks, or social attacks. Or anything else for that matter.{' '}
      <Kb.Text type="BodyExtrabold" style={styles.bodyText}>
        Keybase will not reimburse for any lost cryptocurrency due to user error or Keybase error of any kind.
      </Kb.Text>
    </Kb.Text>
    <Kb.Text type="Body" style={styles.bodyText}>
      7. YOU AGREE TO LEARN MORE ABOUT STELLAR. You agree to learn about Stellar by visiting{' '}
      <Kb.Text
        type="BodyPrimaryLink"
        onClick={() => openURL('https://www.stellar.org')}
        style={styles.bodyText}
      >
        https://www.stellar.org
      </Kb.Text>{' '}
      and by testing Stellar-in-Keybase, simply by sending Lumens to people you care about, or at least your
      enemies' enemies.
    </Kb.Text>
    <Kb.Text type="Body" style={styles.bodyText}>
      8. FINALLY HAVE FUN WHILE YOU CAN. Something is coming.
    </Kb.Text>

    {/* Spacer to get over the gradient at the end. */}
    {!Styles.isMobile && (
      <Kb.Text type="Body" style={styles.bodyText}>
        <br />
      </Kb.Text>
    )}
  </>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      background: {backgroundColor: Styles.globalColors.purple},
      bodyBullet: {
        marginLeft: Styles.globalMargins.tiny,
        marginTop: 0,
      },
      bodyText: {
        color: Styles.globalColors.white,
        marginTop: Styles.globalMargins.xsmall,
        textAlign: 'left',
      },
      buttonBar: Styles.platformStyles({
        isElectron: {
          minHeight: 40,
        },
      }),
      buttonLabelStyle: {color: Styles.globalColors.purpleDark},
      buttonStyle: {backgroundColor: Styles.globalColors.white, width: '100%'},
      closeLabelStyle: {color: Styles.globalColors.white},
      container: {
        backgroundColor: Styles.globalColors.purple,
        paddingBottom: Styles.globalMargins.medium,
        paddingLeft: Styles.globalMargins.medium,
        paddingRight: Styles.globalMargins.medium,
        paddingTop: 0,
      },
      disclaimerContainer: {marginTop: Styles.globalMargins.small},
      gradient: Styles.platformStyles({
        isElectron: {
          backgroundImage: `linear-gradient(to bottom, ${Styles.globalColors.purple_01}, ${Styles.globalColors.purple})`,
          bottom: 0,
          height: Styles.globalMargins.large,
          left: 0,
          position: 'absolute',
          width: '100%',
        },
      }),
      header: {
        marginTop: Styles.globalMargins.small,
      },
      headerText: {
        color: Styles.globalColors.white,
      },
      labelStyle: {
        color: Styles.globalColors.purpleDark,
      },
      notNowButtonStyle: {width: '100%'},
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
      section: {marginBottom: Styles.globalMargins.xxtiny},
    } as const)
)

export default Disclaimer
