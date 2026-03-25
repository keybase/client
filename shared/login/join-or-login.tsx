import * as C from '@/constants'
import * as React from 'react'
import {useConfigState} from '@/stores/config'
import * as Kb from '@/common-adapters'
import {InfoIcon} from '@/signup/common'
import {useSignupState} from '@/stores/signup'
import {useProvisionState} from '@/stores/provision'
import {getLoggedOutBannerMessage} from './flow'

const useLoggedOutIntroState = () => {
  const {isOnline, justDeletedSelf, justRevokedSelf, loadIsOnline} = useConfigState(
    C.useShallow(s => ({
      isOnline: s.isOnline,
      justDeletedSelf: s.justDeletedSelf,
      justRevokedSelf: s.justRevokedSelf,
      loadIsOnline: s.dispatch.loadIsOnline,
    }))
  )
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const requestAutoInvite = useSignupState(s => s.dispatch.requestAutoInvite)
  const startProvision = useProvisionState(s => s.dispatch.startProvision)
  const [showing, setShowing] = React.useState(true)
  Kb.useInterval(loadIsOnline, showing ? 5000 : undefined)

  C.Router2.useSafeFocusEffect(() => {
    setShowing(true)
    return () => setShowing(false)
  })

  return {
    bannerMessage: getLoggedOutBannerMessage({justDeletedSelf, justRevokedSelf}),
    isOnline,
    onLogin: () => startProvision(),
    onSignup: () => requestAutoInvite(),
    showProxySettings: () => navigateAppend('proxySettingsModal'),
  }
}

const Intro = () => {
  const {bannerMessage, isOnline, onLogin, onSignup, showProxySettings} = useLoggedOutIntroState()

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      alignItems="center"
      style={styles.container}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} justifyContent="flex-end" style={styles.header}>
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
          <Kb.ImageIcon type="icon-keybase-logo-64" />
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
