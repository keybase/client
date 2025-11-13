import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {InfoIcon} from '@/signup/common'
import proxySettingsModal from '../settings/proxy/page'
import {newRoutes as provisionRoutes} from '../provision/routes-sub'
import {sharedNewRoutes as settingsRoutes} from '../settings/routes'
import {newRoutes as signupRoutes} from './signup/routes'

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
  headerLeft: undefined, // no back button
  headerRightActions,
}

export const newRoutes = {
  feedback: settingsRoutes[C.Settings.settingsFeedbackTab],
  login: {screen: React.lazy(async () => import('.'))},
  recoverPasswordDeviceSelector: {
    screen: React.lazy(async () => import('./recover-password/device-selector/container')),
  },
  recoverPasswordError: {
    getOptions: {
      gesturesEnabled: false,
      headerLeft: undefined, // no back button
      headerRightActions,
    },
    screen: React.lazy(async () => import('./recover-password/error')),
  },
  recoverPasswordExplainDevice: {
    getOptions: recoverPasswordGetOptions,
    screen: React.lazy(async () => import('./recover-password/explain-device')),
  },
  recoverPasswordPaperKey: {
    getOptions: recoverPasswordGetOptions,
    screen: React.lazy(async () => import('./recover-password/paper-key')),
  },
  recoverPasswordPromptResetAccount: {
    getOptions: recoverPasswordGetOptions,
    screen: React.lazy(async () => import('./recover-password/prompt-reset-account')),
  },
  recoverPasswordPromptResetPassword: {
    getOptions: recoverPasswordGetOptions,
    screen: React.lazy(async () => import('./recover-password/prompt-reset-password')),
  },
  resetConfirm: {
    getOptions: {gesturesEnabled: false},
    screen: React.lazy(async () => import('./reset/confirm')),
  },
  resetEnterPassword: {screen: React.lazy(async () => import('./reset/password-enter'))},
  resetKnowPassword: {screen: React.lazy(async () => import('./reset/password-known'))},
  resetWaiting: C.makeScreen(React.lazy(async () => import('./reset/waiting'))),
  ...provisionRoutes,
  ...signupRoutes,
}
export const newModalRoutes = {
  proxySettingsModal,
  recoverPasswordErrorModal: {
    getOptions: {gesturesEnabled: false},
    screen: React.lazy(async () => import('./recover-password/error-modal')),
  },
  recoverPasswordSetPassword: {
    getOptions: {gesturesEnabled: false},
    screen: React.lazy(async () => import('./recover-password/password')),
  },
}

export type RootParamListLogin = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
