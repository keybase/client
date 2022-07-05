import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {InfoIcon} from '../../signup/common'

type Props = {
  bannerMessage: string | null
  checkIsOnline: () => void
  onLogin: () => void
  onSignup: () => void
  isOnline: boolean | null
  showProxySettings: () => void
}

const Intro = (props: Props) => {
  const [showing, setShowing] = React.useState(true)
  Kb.useInterval(props.checkIsOnline, showing ? 5000 : undefined)
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      alignItems="center"
      style={styles.container}
    >
      {Styles.isMobile && (
        <Kb.NavigationEvents onDidFocus={() => setShowing(true)} onWillBlur={() => setShowing(false)} />
      )}
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header}>
        <InfoIcon />
      </Kb.Box2>
      {!!props.bannerMessage && <Kb.Banner color="blue">{props.bannerMessage}</Kb.Banner>}
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        gap="large"
        alignItems="center"
        centerChildren={true}
      >
        <Kb.Box2 direction="vertical" fullWidth={true} gap="small" alignItems="center">
          <Kb.Icon type="icon-keybase-logo-64" />
          <Kb.Text type="HeaderBig" style={styles.text}>
            Join Keybase
          </Kb.Text>
        </Kb.Box2>
        <Kb.ButtonBar direction="column" fullWidth={Styles.isMobile} style={styles.buttonBar}>
          <Kb.Button label="Create an account" onClick={props.onSignup} fullWidth={true} />
          <Kb.Button label="Log in" mode="Secondary" onClick={props.onLogin} fullWidth={true} />
          {props.isOnline === false && (
            <Kb.Button
              label="Configure a proxy"
              mode="Secondary"
              onClick={props.showProxySettings}
              fullWidth={true}
            />
          )}
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      banner: {
        backgroundColor: Styles.globalColors.blue,
        justifyContent: 'center',
        minHeight: 40,
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.xlarge,
        paddingRight: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.xlarge,
        paddingTop: Styles.globalMargins.tiny,
        position: 'absolute',
        top: 50,
      },
      bannerMessage: {color: Styles.globalColors.white},
      buttonBar: Styles.platformStyles({
        isElectron: {
          paddingBottom: Styles.globalMargins.xlarge - Styles.globalMargins.tiny, // tiny added inside buttonbar
          width: 368,
        },
        isMobile: {
          ...Styles.padding(0, Styles.globalMargins.small, Styles.globalMargins.tiny),
        },
        isTablet: {
          alignItems: 'center',
          width: '100%',
        },
      }),
      container: {
        backgroundColor: Styles.globalColors.white,
      },
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
    } as const)
)

export default Intro
