import * as React from 'react'
import * as Kb from '../../common-adapters'
import {InfoIcon} from '../../signup/common'
import {useFocusEffect} from '@react-navigation/core'

type Props = {
  bannerMessage?: string
  checkIsOnline: () => void
  onLogin: () => void
  onSignup: () => void
  isOnline?: boolean
  showProxySettings: () => void
}

const Intro = (props: Props) => {
  const [showing, setShowing] = React.useState(true)
  Kb.useInterval(props.checkIsOnline, showing ? 5000 : undefined)

  useFocusEffect(
    React.useCallback(() => {
      setShowing(true)
      return () => setShowing(false)
    }, [])
  )

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      alignItems="center"
      style={styles.container}
    >
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
        <Kb.ButtonBar direction="column" fullWidth={Kb.Styles.isMobile} style={styles.buttonBar}>
          <Kb.Button label="Create account" onClick={props.onSignup} fullWidth={true} />
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      banner: {
        backgroundColor: Kb.Styles.globalColors.blue,
        justifyContent: 'center',
        minHeight: 40,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.isMobile ? Kb.Styles.globalMargins.small : Kb.Styles.globalMargins.xlarge,
        paddingRight: Kb.Styles.isMobile ? Kb.Styles.globalMargins.small : Kb.Styles.globalMargins.xlarge,
        paddingTop: Kb.Styles.globalMargins.tiny,
        position: 'absolute',
        top: 50,
      },
      bannerMessage: {color: Kb.Styles.globalColors.white},
      buttonBar: Kb.Styles.platformStyles({
        isElectron: {
          paddingBottom: Kb.Styles.globalMargins.xlarge - Kb.Styles.globalMargins.tiny, // tiny added inside buttonbar
          width: 368,
        },
        isMobile: {
          ...Kb.Styles.padding(0, Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.tiny),
        },
        isTablet: {
          alignItems: 'center',
          width: '100%',
        },
      }),
      container: {
        backgroundColor: Kb.Styles.globalColors.white,
      },
      header: Kb.Styles.platformStyles({
        common: {justifyContent: 'flex-end'},
        isElectron: {padding: Kb.Styles.globalMargins.small},
        isMobile: {
          paddingRight: Kb.Styles.globalMargins.small,
          paddingTop: 10,
        },
      }),
      text: {
        color: Kb.Styles.globalColors.orange,
      },
    }) as const
)

export default Intro
