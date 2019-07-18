import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = Kb.PropsWithTimer<{
  bannerMessage: string | null
  checkIsOnline: () => void
  onFeedback: (() => void) | null
  onLogin: () => void
  onSignup: () => void
  isOnline: boolean | null
  showProxySettings: () => void
}>

const Feedback = ({onFeedback}) =>
  onFeedback ? (
    <Kb.Text type="BodySmallSecondaryLink" onClick={onFeedback}>
      Problems logging in?
    </Kb.Text>
  ) : (
    <Kb.Text type="BodySmall">
      Send us feedback! Run{' '}
      <Kb.Text type="TerminalInline" selectable={true}>
        keybase log send
      </Kb.Text>{' '}
      from the terminal.
    </Kb.Text>
  )

class Intro extends React.Component<Props, {}> {
  intervalId: NodeJS.Timeout | null

  constructor(props: Props) {
    super(props)

    this.intervalId = null
  }

  componentDidMount() {
    this.props.checkIsOnline()

    this.intervalId && this.props.clearTimeout(this.intervalId)
    this.intervalId = this.props.setInterval(this.props.checkIsOnline, 2000)
  }

  componentWillUnmount() {
    this.intervalId && this.props.clearInterval(this.intervalId)
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        {!!this.props.bannerMessage && (
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.banner}>
            <Kb.Text center={true} type="BodySmallSemibold" style={styles.bannerMessage}>
              {this.props.bannerMessage}
            </Kb.Text>
          </Kb.Box2>
        )}
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          gap="large"
          style={styles.innerContainer}
        >
          <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={styles.alignItemsCenter}>
            <Kb.Icon type="icon-keybase-logo-80" />
            <Kb.Text type="HeaderBig" style={styles.join}>
              Join Keybase
            </Kb.Text>
            <Kb.ButtonBar>
              <Kb.Button onClick={this.props.onSignup} label="Create an account" />
            </Kb.ButtonBar>
          </Kb.Box2>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.alignItemsCenter}>
            <Kb.Text type="Body" onClick={this.props.onLogin}>
              Already on Keybase?
            </Kb.Text>
            <Kb.ButtonBar>
              <Kb.Button type="Dim" onClick={this.props.onLogin} label="Log in" />
            </Kb.ButtonBar>
          </Kb.Box2>
          <Feedback onFeedback={this.props.onFeedback} />
          {!this.props.isOnline && (
            <Kb.Text type="BodySmallPrimaryLink" onClick={this.props.showProxySettings}>
              Configure a Proxy
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  alignItemsCenter: {
    alignItems: 'center',
  },
  banner: {
    backgroundColor: Styles.globalColors.blue,
    justifyContent: 'center',
    minHeight: 40,
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.xlarge,
    paddingRight: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.xlarge,
    paddingTop: Styles.globalMargins.tiny,
    position: 'absolute',
  },
  bannerMessage: {color: Styles.globalColors.white},
  innerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.large,
  },
  join: {color: Styles.globalColors.orange},
})

export default Intro
