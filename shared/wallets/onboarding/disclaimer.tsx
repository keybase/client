import * as React from 'react'
import * as Constants from '../../constants/wallets'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletPopup} from '../common'
import {addTicker, removeTicker, TickerID} from '../../util/second-timer'

type DisclaimerProps = {
  acceptDisclaimerError: string
  acceptingDisclaimerDelay: boolean
  onAcceptDisclaimer: () => void
  onCheckDisclaimer: () => void
  onNotNow: () => void
  sections: ReadonlyArray<{
    lines: ReadonlyArray<{
      bullet: boolean
      text: string
    }>
    section: string
    icon: string | null
  }>
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
    this.setState({secondsLeftAfterAccept: Math.max(0, this.state.secondsLeftAfterAccept - 1)}, () => {
      if (this.state.secondsLeftAfterAccept === 0 && this.afterTimer) {
        removeTicker(this.afterTimer)
        this.afterTimer = null
        this.props.onCheckDisclaimer()
      }
    })
  }

  beforeTick = () => {
    this.setState({secondsLeftBeforeAccept: this.state.secondsLeftBeforeAccept - 1}, () => {
      if (this.state.secondsLeftBeforeAccept === 0 && this.beforeTimer) {
        removeTicker(this.beforeTimer)
      }
    })
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
    const afterLabel = `Opening your Wallet`.concat(
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

    return (
      <WalletPopup
        bottomButtons={buttons}
        onExit={this.props.onNotNow}
        backButtonType="close"
        buttonBarDirection="column"
        containerStyle={styles.container}
        buttonBarStyle={styles.buttonBar}
      >
        <Kb.Box2 direction="vertical" style={styles.header}>
          <Kb.Text type="Header" style={styles.headerText}>
            Almost done.
          </Kb.Text>
          <Kb.Text type="Header" style={styles.headerText}>
            It's important you read this.
          </Kb.Text>
        </Kb.Box2>

        <Kb.ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContentContainer}>
          {this.props.sections.map(b =>
            b.lines.map(l => (
              <Kb.Markdown key={l.text} style={l.bullet ? Styles.collapseStyles([styles.bodyText, styles.bodyBullet]) : styles.bodyText}>
                {(l.bullet ? "• " : "").concat(l.text)}
              </Kb.Markdown>
            ))
          )}
        </Kb.ScrollView>

        <Kb.Box style={styles.gradient} />
        {!!this.props.acceptDisclaimerError && (
          <Kb.Banner inline={true} color="red">
            <Kb.BannerParagraph bannerColor="red" content={this.props.acceptDisclaimerError} />
          </Kb.Banner>
        )}
      </WalletPopup>
    )
  }
}

const styles = Styles.styleSheetCreate({
  bodyBullet: {
    marginBottom: Styles.globalMargins.tiny,
    marginLeft: Styles.globalMargins.tiny,
  },
  bodyText: {
    color: Styles.globalColors.white,
    marginBottom: Styles.globalMargins.xsmall,
    textAlign: 'left',
  },
  buttonBar: Styles.platformStyles({
    isElectron: {
      minHeight: 40,
    },
  }),
  buttonLabelStyle: {color: Styles.globalColors.purpleDark},
  buttonStyle: {backgroundColor: Styles.globalColors.white, width: '100%'},
  container: {
    backgroundColor: Styles.globalColors.purple,
    padding: Styles.globalMargins.medium,
  },
  gradient: Styles.platformStyles({
    isElectron: {
      backgroundImage: `linear-gradient(to bottom, ${Styles.globalColors.purple_01}, ${
        Styles.globalColors.purple
      })`,
      height: Styles.globalMargins.large,
      position: 'relative',
      top: -30,
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
})

export default Disclaimer
