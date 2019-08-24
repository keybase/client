import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {InfoIcon} from '../common'

type Props = {
  onCreateAccount: () => void
  onDocumentation: () => void
  onFeedback: () => void
  onLogin: () => void
}

const JoinOrLogin = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} alignItems="center">
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header}>
      <InfoIcon onDocumentation={props.onDocumentation} onFeedback={props.onFeedback} />
    </Kb.Box2>
    <Kb.Box2 centerChildren={true} direction="vertical" gap="small" style={styles.body} fullWidth={true}>
      <Kb.Icon type="icon-keybase-logo-64" />
      <Kb.Text type="HeaderBig" style={styles.text}>
        Join Keybase
      </Kb.Text>
    </Kb.Box2>
    <Kb.ButtonBar direction="column" fullWidth={Styles.isMobile} style={styles.buttonBar}>
      <Kb.Button
        label="Create an account"
        onClick={props.onCreateAccount}
        style={styles.button}
        fullWidth={true}
      />
      <Kb.Button
        mode="Secondary"
        label="Log in"
        onClick={props.onLogin}
        style={styles.button}
        fullWidth={true}
      />
    </Kb.ButtonBar>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  body: {
    flex: 1,
  },
  button: Styles.platformStyles({
    isElectron: {
      width: 368,
    },
    isMobile: {
      width: '100%',
    },
  }),
  buttonBar: Styles.platformStyles({
    isElectron: {
      paddingBottom: Styles.globalMargins.xlarge - Styles.globalMargins.tiny, // tiny added inside buttonbar
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small, Styles.globalMargins.tiny),
    },
  }),
  header: Styles.platformStyles({
    common: {
      justifyContent: 'flex-end',
    },
    isElectron: {
      padding: Styles.globalMargins.small,
    },
    isMobile: {
      paddingRight: Styles.globalMargins.small,
      paddingTop: 10,
    },
  }),
  text: {
    color: Styles.globalColors.orange,
  },
})

export default JoinOrLogin
