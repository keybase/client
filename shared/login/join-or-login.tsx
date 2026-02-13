import * as C from '@/constants'
import * as React from 'react'
import {useConfigState} from '@/stores/config'
import * as Kb from '@/common-adapters'
import {InfoIcon} from '@/signup/common'
import {useSignupState} from '@/stores/signup'
import {useProvisionState} from '@/stores/provision'

const Intro = () => {
  const justDeletedSelf = useConfigState(s => s.justDeletedSelf)
  const justRevokedSelf = useConfigState(s => s.justRevokedSelf)
  const bannerMessage = justDeletedSelf
    ? `Your Keybase account ${justDeletedSelf} has been deleted. Au revoir!`
    : justRevokedSelf
      ? `${justRevokedSelf} was revoked successfully`
      : ''

  const isOnline = useConfigState(s => s.isOnline)
  const loadIsOnline = useConfigState(s => s.dispatch.loadIsOnline)

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const checkIsOnline = loadIsOnline
  const startProvision = useProvisionState(s => s.dispatch.startProvision)
  const onLogin = () => {
    startProvision()
  }
  const requestAutoInvite = useSignupState(s => s.dispatch.requestAutoInvite)
  const onSignup = () => {
    requestAutoInvite()
  }
  const showProxySettings = () => {
    navigateAppend('proxySettingsModal')
  }
  const [showing, setShowing] = React.useState(true)
  Kb.useInterval(checkIsOnline, showing ? 5000 : undefined)

  C.Router2.useSafeFocusEffect(
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
      {!!bannerMessage && <Kb.Banner color="blue">{bannerMessage}</Kb.Banner>}
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
          <Kb.Button label="Create account" onClick={onSignup} fullWidth={true} />
          <Kb.Button label="Log in" mode="Secondary" onClick={onLogin} fullWidth={true} />
          {isOnline ? null : (
            <Kb.Button
              label="Configure a proxy"
              mode="Secondary"
              onClick={showProxySettings}
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
