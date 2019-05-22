import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  bannerMessage: string | null
  onFeedback: () => void | null
  onLogin: () => void
  onSignup: () => void
}

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

const Intro = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    {!!props.bannerMessage && (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.banner}>
        <Kb.Text center={true} type="BodySmallSemibold" style={styles.bannerMessage}>
          {props.bannerMessage}
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
          <Kb.Button onClick={props.onSignup} label="Create an account" />
        </Kb.ButtonBar>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.alignItemsCenter}>
        <Kb.Text type="Body" onClick={props.onLogin}>
          Already on Keybase?
        </Kb.Text>
        <Kb.ButtonBar>
          <Kb.Button type="Dim" onClick={props.onLogin} label="Log in" />
        </Kb.ButtonBar>
      </Kb.Box2>
      <Feedback onFeedback={props.onFeedback} />
    </Kb.Box2>
  </Kb.Box2>
)

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
