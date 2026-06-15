import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {InfoIcon} from '@/signup/common'
import {newRoutes as provisionRoutes} from '../provision/routes-sub'
import {sharedNewRoutes as settingsRoutes} from '../settings/routes'
import {newRoutes as signupRoutes} from './signup/routes'
import {settingsFeedbackTab} from '@/constants/settings'
import {defineRouteMap} from '@/constants/types/router'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import useRequestAutoInvite from '@/signup/use-request-auto-invite'
import {useRoute} from '@react-navigation/native'
import {cancelRecoverPassword, startRecoverPassword} from './recover-password/flow'

// The login route is a state multiplexer (loading / relogin / join). Only the relogin mode wants a
// header title + "Create account" action, so the desktop header reads the same state to decide.
const useShowRelogin = () => {
  const userSwitching = useConfigState(s => s.userSwitching)
  const isLoggedIn = useConfigState(s => s.loggedIn)
  const hasAccounts = useConfigState(s => s.configuredAccounts.length > 0)
  const handshakeDone = useDaemonState(s => s.handshakeState === 'done')
  const showLoading = !handshakeDone || userSwitching
  return !isLoggedIn && !showLoading && hasAccounts
}

const LoginHeaderTitle = () => (useShowRelogin() ? <Kb.Text type="Header">Log in</Kb.Text> : null)

const LoginHeaderRight = () => {
  const showRelogin = useShowRelogin()
  const requestAutoInvite = useRequestAutoInvite()
  if (!showRelogin) return null
  return (
    <Kb.Box2 direction="horizontal" style={loginHeaderStyles.createAccount}>
      <Kb.Text type="BodyBigLink" onClick={() => requestAutoInvite('')}>
        Create account
      </Kb.Text>
    </Kb.Box2>
  )
}

const loginHeaderStyles = Kb.Styles.styleSheetCreate(() => ({
  createAccount: Kb.Styles.platformStyles({
    isElectron: {paddingRight: Kb.Styles.globalMargins.small},
  }),
}))

// Recover-password back affordances must run the flow's back/cancel logic (not a plain pop), so they
// are wired as the React Navigation headerLeft. They read the current route's params via useRoute.
const RecoverCancelLeft = () => (
  <Kb.HeaderLeftButton autoDetectCanGoBack={true} onPress={cancelRecoverPassword} />
)
const RecoverPopLeft = () => (
  <Kb.HeaderLeftButton autoDetectCanGoBack={true} onPress={C.Router2.popStack} />
)
const RecoverRestartLeft = () => {
  const route = useRoute()
  const username = (route.params as {username?: string} | undefined)?.username ?? ''
  return (
    <Kb.HeaderLeftButton
      autoDetectCanGoBack={true}
      onPress={() => startRecoverPassword({replaceRoute: true, username})}
    />
  )
}
const PromptResetAccountLeft = () => {
  const route = useRoute()
  const {skipPassword, username} = (route.params as {skipPassword?: boolean; username?: string} | undefined) ?? {}
  return (
    <Kb.HeaderLeftButton
      autoDetectCanGoBack={true}
      onPress={() =>
        skipPassword
          ? startRecoverPassword({replaceRoute: true, username: username ?? ''})
          : C.Router2.navigateUp()
      }
    />
  )
}

const recoverPasswordStyles = Kb.Styles.styleSheetCreate(() => ({
  questionBox: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, 0),
}))

const headerRightActions = () => (
  <Kb.Box2 direction="horizontal" style={recoverPasswordStyles.questionBox}>
    <InfoIcon />
  </Kb.Box2>
)

const recoverPasswordGetOptions = {
  headerBottomStyle: {height: undefined},
  headerRightActions,
  title: 'Recover password',
}

export const newRoutes = defineRouteMap({
  feedback: settingsRoutes[settingsFeedbackTab],
  login: {
    getOptions: isMobile
      ? {headerShown: false}
      : {
          headerLeft: () => null,
          headerRightActions: () => <LoginHeaderRight />,
          headerTitle: () => <LoginHeaderTitle />,
        },
    screen: React.lazy(async () => import('.')),
  },
  recoverPasswordDeviceSelector: {
    getOptions: {headerLeft: () => <RecoverCancelLeft />, title: 'Recover password'},
    screen: React.lazy(async () => import('./recover-password/device-selector')),
  },
  recoverPasswordError: {
    getOptions: {
      gestureEnabled: false,
      headerLeft: () => <RecoverPopLeft />,
      headerRightActions,
      title: 'Recover password',
    },
    screen: React.lazy(async () => import('./recover-password/error')),
  },
  recoverPasswordExplainDevice: {
    getOptions: {...recoverPasswordGetOptions, headerLeft: () => <RecoverRestartLeft />},
    screen: React.lazy(async () => import('./recover-password/explain-device')),
  },
  recoverPasswordPaperKey: {
    getOptions: {...recoverPasswordGetOptions, headerLeft: () => <RecoverCancelLeft />},
    screen: React.lazy(async () => import('./recover-password/paper-key')),
  },
  recoverPasswordPromptResetAccount: {
    getOptions: {...recoverPasswordGetOptions, headerLeft: () => <PromptResetAccountLeft />},
    screen: React.lazy(async () => import('./recover-password/prompt-reset-account')),
  },
  recoverPasswordPromptResetPassword: {
    getOptions: {...recoverPasswordGetOptions, headerLeft: () => <RecoverRestartLeft />},
    screen: React.lazy(async () => import('./recover-password/prompt-reset-password')),
  },
  resetConfirm: {
    getOptions: {gestureEnabled: false, title: 'Account reset'},
    screen: React.lazy(async () => import('./reset/confirm')),
  },
  resetEnterPassword: {
    getOptions: {title: 'Account reset'},
    screen: React.lazy(async () => import('./reset/password-enter')),
  },
  resetKnowPassword: {
    getOptions: {title: 'Account reset'},
    screen: React.lazy(async () => import('./reset/password-known')),
  },
  resetWaiting: C.makeScreen(React.lazy(async () => import('./reset/waiting')), {
    getOptions: {headerLeft: () => null, title: 'Account reset'},
  }),
  ...provisionRoutes,
  ...signupRoutes,
})
export const newModalRoutes = defineRouteMap({
  proxySettingsModal: {
    getOptions: {title: 'Proxy settings'},
    screen: React.lazy(async () => import('../settings/proxy')),
  },
  recoverPasswordErrorModal: {
    getOptions: {gestureEnabled: false, title: 'Error'},
    screen: React.lazy(async () => import('./recover-password/error-modal')),
  },
  recoverPasswordSetPassword: {
    getOptions: {gestureEnabled: false, title: 'Set password'},
    screen: React.lazy(async () => import('./recover-password/password')),
  },
})
